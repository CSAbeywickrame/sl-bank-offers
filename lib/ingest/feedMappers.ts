import * as cheerio from "cheerio";
import { categorizeOfferText } from "@/lib/ingest/categorize";
import { normalizeText } from "@/lib/ingest/textUtils";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";
import { offerCategories, type OfferCategory, type ScannedOffer } from "@/lib/offers/types";

/**
 * Deterministic mappers for banks that expose a structured JSON API.
 *
 * Sources whose bankId has a mapper here are parsed directly (no LLM, no token cost, exact
 * fields). The orchestrator routes such sources through the mapper instead of extractWithClaude.
 */
export type FeedMapper = (rawJsonText: string, entry: BankRegistryEntry, reviewDateIso: string) => ScannedOffer[];

// Strips HTML tags/entities from a field and normalizes whitespace.
function stripHtml(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "";
  return normalizeText(cheerio.load(value).text());
}

// Converts an epoch-milliseconds string/number to a YYYY-MM-DD date, or undefined.
function epochToDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

// Maps a Sampath API category + discount text to one of our offer categories.
function sampathCategory(rawCategory: unknown, discountText: string): OfferCategory {
  if (/instal?ment/i.test(discountText) || /0%\s*(interest|p\.?\s?a)/i.test(discountText)) return "installment";
  if (/cash\s?back/i.test(discountText)) return "cashback";
  const map: Record<string, OfferCategory> = {
    dining: "dining",
    hotels: "travel",
    travel_and_leisure: "travel",
    super_markets: "supermarket",
    online: "online",
    fuel: "fuel"
  };
  const key = typeof rawCategory === "string" ? rawCategory : "";
  const mapped = map[key];
  return mapped && offerCategories.includes(mapped) ? mapped : "other";
}

interface SampathRaw {
  id?: unknown;
  company_name?: unknown;
  short_discount?: unknown;
  short_description?: unknown;
  description?: unknown;
  category?: unknown;
  city?: unknown;
  expire_on?: unknown;
  display_on?: unknown;
  enable?: unknown;
  delete_status?: unknown;
}

// Maps the Sampath card-promotions API response into ScannedOffers.
function mapSampath(rawJsonText: string, entry: BankRegistryEntry, reviewDateIso: string): ScannedOffer[] {
  // Throw actionable errors so a malformed/changed feed surfaces clearly (and keeps existing rows).
  if (!rawJsonText.trim()) throw new Error("Sampath feed: empty response");
  let parsed: { data?: unknown };
  try {
    parsed = JSON.parse(rawJsonText) as { data?: unknown };
  } catch {
    throw new Error("Sampath feed: response was not valid JSON");
  }
  if (!Array.isArray(parsed.data)) throw new Error("Sampath feed: expected { data: [...] } shape");
  const rows = parsed.data as SampathRaw[];
  const pageUrl = "https://www.sampath.lk/sampath-cards/credit-card-offer";

  const byId = new Map<string, ScannedOffer>();
  for (const row of rows) {
    if (row.enable === false || row.delete_status === true) continue;
    if (row.id === null || row.id === undefined) continue;

    const merchant = normalizeText(typeof row.company_name === "string" ? row.company_name : "");
    const discount = normalizeText(typeof row.short_discount === "string" ? row.short_discount : "");
    const description = stripHtml(row.description) || stripHtml(row.short_description) || discount;
    const title = discount && merchant ? `${discount} at ${merchant}` : merchant || discount || description.slice(0, 80);
    if (!title) continue;

    const category = sampathCategory(row.category, discount);
    const sourceUrl = typeof row.category === "string" ? `${pageUrl}?firstTab=${row.category}` : pageUrl;

    const offer: ScannedOffer = {
      id: `sampath-${String(row.id)}`,
      bankId: entry.bankId,
      cardId: entry.defaultCardId,
      title,
      category,
      description,
      merchant: merchant || undefined,
      location: typeof row.city === "string" && row.city.trim() ? normalizeText(row.city) : undefined,
      validFrom: epochToDate(row.display_on),
      validUntil: epochToDate(row.expire_on),
      termsLink: pageUrl,
      sourceUrl,
      lastReviewedAt: reviewDateIso,
      status: "active"
    };
    byId.set(offer.id, offer);
  }
  return [...byId.values()];
}

interface HnbRaw {
  id?: unknown;
  title?: unknown;
  merchant?: unknown;
  cardType?: unknown;
  to?: unknown;
  valid?: unknown;
}

// Routes an HNB promo to the credit or debit card entry based on its cardType
// ("credit" | "credit/debit" | "debit"; credit/debit rows go to the default credit card).
function hnbCardId(cardType: unknown, entry: BankRegistryEntry): string {
  if (typeof cardType === "string" && cardType.trim().toLowerCase() === "debit") {
    const debitCard = entry.cards.find((card) => card.id.includes("debit"));
    if (debitCard) return debitCard.id;
  }
  return entry.defaultCardId;
}

// Maps the HNB venus API card-promos response into ScannedOffers.
function mapHnb(rawJsonText: string, entry: BankRegistryEntry, reviewDateIso: string): ScannedOffer[] {
  // Throw actionable errors so a malformed/changed feed surfaces clearly (and keeps existing rows).
  if (!rawJsonText.trim()) throw new Error("HNB feed: empty response");
  let parsed: { data?: unknown; total?: unknown };
  try {
    parsed = JSON.parse(rawJsonText) as { data?: unknown; total?: unknown };
  } catch {
    throw new Error("HNB feed: response was not valid JSON");
  }
  if (!Array.isArray(parsed.data)) throw new Error("HNB feed: expected { data: [...] } shape");
  const rows = parsed.data as HnbRaw[];
  // Number() keeps the guard working if the API ever returns total as a quoted string.
  const total = Number(parsed.total);
  if (Number.isFinite(total) && total > rows.length) {
    throw new Error(`HNB feed: truncated response (${rows.length}/${total} rows) — API may now cap 'limit'`);
  }

  const byId = new Map<string, ScannedOffer>();
  for (const row of rows) {
    // Ids must be numbers or non-empty strings; anything else would stringify into
    // garbage offer ids/URLs (e.g. "hnb-[object Object]") that can silently collide.
    if (typeof row.id !== "number" && (typeof row.id !== "string" || !row.id.trim())) continue;
    const idStr = String(row.id);

    const title = normalizeText(typeof row.title === "string" ? row.title : "");
    if (!title) continue;

    const merchant = normalizeText(typeof row.merchant === "string" ? row.merchant : "") || undefined;
    const cardId = hnbCardId(row.cardType, entry);
    const category = categorizeOfferText(title);
    const validUntil = typeof row.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.to) ? row.to : undefined;
    const validFromMatch = typeof row.valid === "string" ? row.valid.match(/Valid From (\d{4}-\d{2}-\d{2})/) : null;
    const validFrom = validFromMatch ? validFromMatch[1] : undefined;
    const detailUrl = `https://www.hnb.lk/card-promotion/search/${idStr}`;

    const offer: ScannedOffer = {
      id: `hnb-${idStr}`,
      bankId: entry.bankId,
      cardId,
      title,
      category,
      description: title,
      merchant,
      validFrom,
      validUntil,
      termsLink: detailUrl,
      sourceUrl: detailUrl,
      lastReviewedAt: reviewDateIso,
      status: "active"
    };
    byId.set(offer.id, offer);
  }
  return [...byId.values()];
}

// Registry of bankId -> deterministic feed mapper. Banks not listed use the Claude extractor.
export const feedMappers: Record<string, FeedMapper> = {
  sampath: mapSampath,
  hnb: mapHnb
};
