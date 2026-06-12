import { categorizeOfferText } from "@/lib/ingest/categorize";
import type { OfferCategory, ScannedOffer } from "./types";

interface RawNdbOffer {
  bank: string;
  category: string;
  offer_amount_percent: number | null;
  offer_about: string;
  expiry_date: string | null;
  source_url: string;
}

const reviewDatePattern = /^\d{4}-\d{2}-\d{2}T/;
const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const legacyOfferIds = new Map<string, string>([
  ["https://www.ndbbank.com/cards/card-offers/offer-details/247", "ndb-findmyfare-june-2026"],
  ["https://www.ndbbank.com/cards/card-offers/offer-details/316", "ndb-education-ipp-june-2026"]
]);
const legacyOfferTitles = new Map<string, string>([
  ["ndb-findmyfare-june-2026", "Flat 20% savings at findmyfare.com with 0% installment plans"],
  ["ndb-education-ipp-june-2026", "Up to 36 months 0% installment plans on education payments"]
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertRawNdbOffer(value: unknown): asserts value is RawNdbOffer {
  if (
    !isRecord(value) ||
    typeof value.bank !== "string" ||
    typeof value.category !== "string" ||
    (value.offer_amount_percent !== null && typeof value.offer_amount_percent !== "number") ||
    typeof value.offer_about !== "string" ||
    (value.expiry_date !== null && typeof value.expiry_date !== "string") ||
    typeof value.source_url !== "string"
  ) {
    throw new Error("NDB scrape rows must include bank, category, offer_about, expiry_date, and source_url.");
  }
}

function assertRawNdbScrape(value: unknown): asserts value is RawNdbOffer[] {
  if (!Array.isArray(value)) {
    throw new Error("NDB scrape must be an array.");
  }

  for (const row of value) {
    assertRawNdbOffer(row);
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

function isActiveRow(row: RawNdbOffer, reviewDate: string): boolean {
  return row.expiry_date === null || row.expiry_date >= reviewDate;
}

function getOfferSummary(description: string): string {
  const summary = description.split("Category:")[0] ?? description;
  return normalizeText(summary.replace(/\.*$/, ""));
}

function getEligibleCards(description: string): string | undefined {
  const match = description.match(/Eligible cards:\s*([^.]*)\./i);
  return match?.[1] ? normalizeText(match[1]) : undefined;
}

function getCardId(description: string): string {
  const eligibleCards = getEligibleCards(description) ?? description;
  return /\b(platinum|signature|infinite|privilege banking)\b/i.test(eligibleCards)
    ? "ndb-premium-credit-cards"
    : "ndb-credit-cards";
}

function mapCategory(rawCategory: string, description: string): OfferCategory {
  switch (rawCategory) {
    case "Dining":
      return "dining";
    case "Supermarket":
      return "supermarket";
    case "Online":
      return "online";
    case "Travel":
      return "travel";
    default: {
      const detected = categorizeOfferText(description);
      return detected === "other" ? "other" : detected;
    }
  }
}

function extractMerchant(summary: string): string | undefined {
  const boundaryPatterns = [
    /\s+-\s+(?:Flat\s+)?(?:Up to|Upto|\d+(?:\.\d+)?%|0%)/i,
    /\s+-\s+\d+\s*Months?\b/i
  ];

  let boundaryIndex = summary.length;

  for (const pattern of boundaryPatterns) {
    const match = pattern.exec(summary);
    if (match && match.index < boundaryIndex) {
      boundaryIndex = match.index;
    }
  }

  if (boundaryIndex < summary.length) {
    return normalizeText(summary.slice(0, boundaryIndex)) || undefined;
  }

  const firstSeparatorIndex = summary.indexOf(" - ");
  if (firstSeparatorIndex !== -1) {
    return normalizeText(summary.slice(0, firstSeparatorIndex)) || undefined;
  }

  return undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function getSourceOfferNumber(sourceUrl: string): string | undefined {
  const match = sourceUrl.match(/\/offer-details\/(\d+)\/?$/);
  return match?.[1];
}

function getExpirySuffix(expiryDate: string | null): string {
  if (!expiryDate) {
    return "";
  }

  const [year, month] = expiryDate.split("-");
  const monthIndex = Number(month) - 1;

  if (!year || monthIndex < 0 || monthIndex > 11) {
    return "";
  }

  return `-${monthNames[monthIndex]}-${year}`;
}

function buildOfferId(row: RawNdbOffer, summary: string, merchant: string | undefined): string {
  const legacyId = legacyOfferIds.get(row.source_url);
  if (legacyId) {
    return legacyId;
  }

  const subject = slugify(merchant ?? summary).slice(0, 48) || "offer";
  const sourceOfferNumber = getSourceOfferNumber(row.source_url);
  const sourceSuffix = sourceOfferNumber ? `-${sourceOfferNumber}` : "";

  return `ndb-${subject}${sourceSuffix}${getExpirySuffix(row.expiry_date)}`;
}

function buildTitle(offerId: string, summary: string): string {
  return legacyOfferTitles.get(offerId) ?? summary;
}

export function transformNdbScrape(raw: unknown, reviewDateIso: string): ScannedOffer[] {
  assertRawNdbScrape(raw);

  const reviewDate = getReviewDate(reviewDateIso);

  return raw
    .filter((row) => isActiveRow(row, reviewDate))
    .map((row) => {
      const description = normalizeText(row.offer_about);
      const summary = getOfferSummary(description);
      const merchant = extractMerchant(summary);
      const id = buildOfferId(row, summary, merchant);

      return {
        bankId: "ndb",
        id,
        cardId: getCardId(description),
        title: buildTitle(id, summary),
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
