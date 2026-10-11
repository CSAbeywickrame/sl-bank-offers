import * as cheerio from "cheerio/slim";
import { categorizeOfferText } from "@/lib/ingest/categorize";
import { normalizeText } from "@/lib/ingest/textUtils";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";
import { parseCardEligibility, parseDiscountPct } from "@/lib/ingest/enrich";
import { type CardKind, type CardNetwork, type OfferCategory, type ScannedOffer } from "@/lib/offers/types";
import { isOfferCategory } from "@/lib/offers/categories";
import { isAbsoluteHttpUrl } from "@/lib/offers/images";

/**
 * Deterministic mappers for banks that expose a structured JSON API.
 *
 * Sources whose bankId has a mapper here are parsed directly (no LLM, no token cost, exact
 * fields). The orchestrator routes such sources through the mapper instead of extractWithClaude.
 */
// Bump whenever a mapper's output changes: it is folded into the refresh hash so unchanged feed JSON
// is re-mapped and re-imported once instead of leaving last week's rows in place.
export const FEED_MAPPER_VERSION = 2;

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

// Maps a Sampath API category tab to one of our verticals. How the offer pays out is no longer
// decided here — that is `offerType`, parsed from the text in lib/ingest/enrich.ts — so an
// instalment plan keeps whatever vertical its tab says it belongs to. Tabs that name a card
// network rather than a vertical fall through to the text rules below.
function sampathCategory(rawCategory: unknown, offerText: string): OfferCategory {
  const map: Record<string, OfferCategory> = {
    dining: "dining",
    hotels: "hotels",
    travel_and_leisure: "travel",
    super_markets: "supermarket",
    online: "online",
    fuel: "fuel",
    // Sampath tabs that now have a real vertical of their own.
    electronics_and_furniture: "electronics",
    health_and_insurance: "health",
    fashion: "fashion",
    // Still no vertical: these tabs describe who qualifies (card network, premium tier), not what
    // is being sold, so the text rules below get a chance before falling back to "other".
    premium_offers: "other",
    visa_offers: "other",
    mastercard_offers: "other",
    other: "other"
  };
  // The API is case-insensitive, so the stored row.category can be e.g. "Hotels" or
  // "Electronics_and_Furniture" — normalize before lookup or it silently falls through to "other".
  const key = typeof rawCategory === "string" ? rawCategory.trim().toLowerCase() : "";
  const mapped = map[key];
  if (mapped && mapped !== "other" && isOfferCategory(mapped)) return mapped;
  // The tab said nothing useful about the vertical, so read it out of the offer text instead —
  // "premium offers" and the card-network tabs are full of real dining and hotel offers. The
  // caller passes merchant and description as well as the discount, because `short_discount` on
  // its own is a bare "20% Discount" on almost every live row and names no vertical at all.
  return categorizeOfferText(offerText);
}

// Card network a Sampath tab is dedicated to, e.g. "VISA_Offers" -> visa. Other tabs name none.
function sampathTabNetwork(rawCategory: unknown): CardNetwork | undefined {
  const key = typeof rawCategory === "string" ? rawCategory.trim().toLowerCase() : "";
  if (key === "visa_offers") return "visa";
  if (key === "mastercard_offers") return "mastercard";
  return undefined;
}

// Absolute http(s) URL for a Sampath image_url (relative paths resolve against the site), or undefined.
function sampathImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim(), "https://www.sampath.lk").href;
    return isAbsoluteHttpUrl(url) ? url : undefined;
  } catch {
    return undefined;
  }
}

// Plain text of the "Eligible Card Categories" block in a Sampath row's cards_new, or "".
function sampathEligibleCardsText(cardsNew: unknown): string {
  if (!Array.isArray(cardsNew)) return "";
  const block = (cardsNew as SampathCardBlock[]).find(
    (card) => typeof card.title === "string" && card.title.trim().toLowerCase() === "eligible card categories"
  );
  return stripHtml(block?.description);
}

interface SampathCardBlock {
  title?: unknown;
  description?: unknown;
}

interface SampathRaw {
  id?: unknown;
  image_url?: unknown;
  cards_new?: unknown;
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
    // Entity-decoded copy for display ("Mastercard Credit &amp; Debit"); `discount` stays raw so titles don't change.
    const discountText = stripHtml(row.short_discount);
    const discountPct = parseDiscountPct(discountText);
    const eligibility = parseCardEligibility(sampathEligibleCardsText(row.cards_new));
    const tabNetwork = sampathTabNetwork(row.category);
    // The eligible-cards block is the specific statement; the tab is only a fallback when it names none.
    const cardNetworks: CardNetwork[] = eligibility.cardNetworks ?? (tabNetwork ? [tabNetwork] : []);
    const imageUrl = sampathImageUrl(row.image_url);
    const description = stripHtml(row.description) || stripHtml(row.short_description) || discount;
    const title = discount && merchant ? `${discount} at ${merchant}` : merchant || discount || description.slice(0, 80);
    if (!title) continue;

    const category = sampathCategory(row.category, `${merchant} ${discount} ${description}`);
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
      // A parsed percentage drives the big "20%" headline (highlight.ts ranks discountPct first), so
      // the label is kept only for what a bare number cannot say: "Special Rates", instalment plans.
      ...(discountPct !== undefined ? { discountPct } : discountText ? { discountLabel: discountText } : {}),
      ...(cardNetworks.length > 0 ? { cardNetworks } : {}),
      ...(eligibility.cardTypes ? { cardTypes: eligibility.cardTypes } : {}),
      ...(eligibility.cardTiers ? { cardTiers: eligibility.cardTiers } : {}),
      // Remote source URL only; the orchestrator swaps it for a local thumbnail (feedImages.ts).
      ...(imageUrl ? { imageUrl } : {}),
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
  thumb?: unknown;
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

// HNB's cardType as card kinds: "credit/debit" (either order) qualifies for both; unknown parts are skipped.
function hnbCardTypes(cardType: unknown): CardKind[] | undefined {
  if (typeof cardType !== "string") return undefined;
  const kinds = cardType
    .split("/")
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is "credit" | "debit" => part === "credit" || part === "debit");
  return kinds.length > 0 ? [...new Set(kinds)] : undefined;
}

// Absolute asset URL for an HNB `thumb` (URL() encodes spaces, keeps existing %xx, takes absolute thumbs), or undefined.
function hnbImageUrl(thumb: unknown): string | undefined {
  if (typeof thumb !== "string" || !thumb.trim()) return undefined;
  try {
    const url = new URL(thumb.trim(), "https://assets.hnb.lk/atdi/").href;
    return isAbsoluteHttpUrl(url) ? url : undefined;
  } catch {
    return undefined;
  }
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
    const cardTypes = hnbCardTypes(row.cardType);
    // Remote source URL only; the orchestrator swaps it for a local thumbnail (feedImages.ts).
    const imageUrl = hnbImageUrl(row.thumb);

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
      ...(cardTypes ? { cardTypes } : {}),
      ...(imageUrl ? { imageUrl } : {}),
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
