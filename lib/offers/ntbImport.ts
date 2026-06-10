import crypto from "node:crypto";
import { categorizeOfferText } from "@/lib/ingest/categorize";
import type { OfferCategory, ScannedOffer } from "./types";

interface RawNtbOffer {
  bank: string;
  category: string;
  offer_amount_percent: number | null;
  offer_about: string;
  expiry_date: string | null;
  source_url: string;
}

const reviewDatePattern = /^\d{4}-\d{2}-\d{2}T/;
const privateBankingSourceUrl = "https://www.nationstrust.com/promotions/enjoy-exclusive-savings-with-private-banking-mastercard-credit-cards";

const legacyOfferIds = new Map<string, string>([
  [`https://www.nationstrust.com/promotions/enjoy-exclusive-savings-on-dining|Butlers`, "ntb-butlers-june-2026"],
  [`https://www.nationstrust.com/promotions/enjoy-exclusive-savings-when-you-shop-online-with-nations-trust-bank-mastercard-cards|Cargills Online`, "ntb-cargills-online-july-2026"],
  [`https://www.nationstrust.com/promotions/enjoy-installment-plans-at-a-range-of-merchant-partners|Up to 12 Month 0% Extended Settlement Plans at anywhere`, "ntb-installments-june-2026"]
]);

const legacyOfferTitles = new Map<string, string>([
  ["ntb-butlers-june-2026", "20% off at Butlers"],
  ["ntb-cargills-online-july-2026", "15% off online at Cargills Online"],
  ["ntb-installments-june-2026", "Up to 12-month 0% extended settlement plans"]
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertRawNtbOffer(value: unknown): asserts value is RawNtbOffer {
  if (
    !isRecord(value) ||
    typeof value.bank !== "string" ||
    typeof value.category !== "string" ||
    (value.offer_amount_percent !== null && typeof value.offer_amount_percent !== "number") ||
    typeof value.offer_about !== "string" ||
    value.expiry_date !== null && typeof value.expiry_date !== "string" ||
    typeof value.source_url !== "string"
  ) {
    throw new Error("NTB scrape rows must include bank, category, offer_about, expiry_date, and source_url.");
  }
}

function assertRawNtbScrape(value: unknown): asserts value is RawNtbOffer[] {
  if (!Array.isArray(value)) {
    throw new Error("NTB scrape must be an array.");
  }

  for (const row of value) {
    assertRawNtbOffer(row);
  }
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getReviewDate(reviewDateIso: string): string {
  if (!reviewDatePattern.test(reviewDateIso)) {
    throw new Error(`Review date must be an ISO timestamp: ${reviewDateIso}`);
  }

  return reviewDateIso.slice(0, 10);
}

function isActiveRow(row: RawNtbOffer, reviewDate: string): boolean {
  return row.expiry_date === null || row.expiry_date >= reviewDate;
}

function extractMerchant(text: string): string | undefined {
  const separatorIndex = text.indexOf(":");

  if (separatorIndex === -1) {
    return undefined;
  }

  return normalizeText(text.slice(0, separatorIndex)) || undefined;
}

function getCardId(row: RawNtbOffer): string {
  return row.source_url === privateBankingSourceUrl || /private banking/i.test(row.offer_about)
    ? "ntb-private-banking-mastercard-credit-cards"
    : "ntb-mastercard-credit-cards";
}

function mapCategory(rawCategory: string, description: string): OfferCategory {
  switch (rawCategory) {
    case "Dining":
      return "dining";
    case "Hotels":
    case "Travel":
      return "travel";
    case "Installment Plans":
      return "installment";
    case "Online":
      return "online";
    case "Supermarket":
      return "supermarket";
    default: {
      const detected = categorizeOfferText(description);
      return detected === "other" ? "other" : detected;
    }
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildOfferId(row: RawNtbOffer, merchant: string | undefined, summary: string, cardId: string): string {
  const legacyKey = `${row.source_url}|${merchant ?? summary}`;
  const legacyId = legacyOfferIds.get(legacyKey);

  if (legacyId) {
    return legacyId;
  }

  const prefix = cardId === "ntb-private-banking-mastercard-credit-cards" ? "ntb-private-banking" : "ntb";
  const subject = slugify(merchant ?? summary).slice(0, 48);
  const hash = crypto.createHash("sha1").update(`${row.source_url}|${summary}|${row.expiry_date ?? "open"}`).digest("hex").slice(0, 8);

  return `${prefix}-${subject || "offer"}-${hash}`;
}

function buildTitle(row: RawNtbOffer, merchant: string | undefined, summary: string, offerId: string): string {
  const legacyTitle = legacyOfferTitles.get(offerId);

  if (legacyTitle) {
    return legacyTitle;
  }

  if (merchant && row.offer_amount_percent !== null) {
    const prefix = /\bup to\b/i.test(summary) ? "Up to " : "";
    return `${prefix}${row.offer_amount_percent}% off at ${merchant}`;
  }

  if (merchant && /companion dining offer/i.test(summary)) {
    return `Companion dining offer at ${merchant}`;
  }

  if (merchant && /installment/i.test(summary)) {
    return `Installment plans at ${merchant}`;
  }

  return summary;
}

export function transformNtbScrape(raw: unknown, reviewDateIso: string): ScannedOffer[] {
  assertRawNtbScrape(raw);

  const reviewDate = getReviewDate(reviewDateIso);

  return raw
    .filter((row) => isActiveRow(row, reviewDate))
    .map((row) => {
      const description = normalizeText(row.offer_about);
      const summary = normalizeText(description.split(";")[0] ?? description);
      const merchant = extractMerchant(description);
      const cardId = getCardId(row);
      const id = buildOfferId(row, merchant, summary, cardId);

      return {
        bankId: "ntb",
        id,
        cardId,
        title: buildTitle(row, merchant, summary, id),
        category: mapCategory(row.category, description),
        description,
        merchant,
        validUntil: row.expiry_date ?? undefined,
        termsLink: row.source_url,
        sourceUrl: row.source_url,
        lastReviewedAt: reviewDateIso,
        status: "active"
      };
    });
}
