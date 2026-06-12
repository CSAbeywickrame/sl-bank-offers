import { categorizeOfferText } from "@/lib/ingest/categorize";
import type { OfferCategory, ScannedOffer } from "./types";

interface RawDfccOffer {
  bank: string;
  category: string;
  offer_amount_percent: number | null;
  offer_about: string;
  expiry_date: string | null;
  source_url: string;
}

const reviewDatePattern = /^\d{4}-\d{2}-\d{2}T/;
const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// Returns true if value is a non-null plain object
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Throws if value does not conform to RawDfccOffer shape
function assertRawDfccOffer(value: unknown): asserts value is RawDfccOffer {
  if (
    !isRecord(value) ||
    typeof value.bank !== "string" ||
    typeof value.category !== "string" ||
    (value.offer_amount_percent !== null && typeof value.offer_amount_percent !== "number") ||
    typeof value.offer_about !== "string" ||
    (value.expiry_date !== null && typeof value.expiry_date !== "string") ||
    typeof value.source_url !== "string"
  ) {
    throw new Error("DFCC scrape rows must include bank, category, offer_about, expiry_date, and source_url.");
  }
}

// Throws if value is not an array of RawDfccOffer
function assertRawDfccScrape(value: unknown): asserts value is RawDfccOffer[] {
  if (!Array.isArray(value)) {
    throw new Error("DFCC scrape must be an array.");
  }

  for (const row of value) {
    assertRawDfccOffer(row);
  }
}

// Normalizes unicode text to ASCII-safe representation
function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Validates and extracts the YYYY-MM-DD portion of an ISO timestamp
function getReviewDate(reviewDateIso: string): string {
  if (!reviewDatePattern.test(reviewDateIso)) {
    throw new Error(`Review date must be an ISO timestamp: ${reviewDateIso}`);
  }

  return reviewDateIso.slice(0, 10);
}

// Returns true if the row has not expired relative to reviewDate
function isActiveRow(row: RawDfccOffer, reviewDate: string): boolean {
  return row.expiry_date === null || row.expiry_date >= reviewDate;
}

// Extracts the last path segment of the source URL as the slug
function getSourceSubject(row: RawDfccOffer): string {
  const slug = new URL(row.source_url).pathname.split("/").filter(Boolean).at(-1);
  return slug ?? "offer";
}

// Builds a month-year suffix string from an expiry date
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

// Builds the unique offer ID from the URL slug and expiry suffix
function buildOfferId(row: RawDfccOffer): string {
  return `dfcc-${getSourceSubject(row)}${getExpirySuffix(row.expiry_date)}`;
}

// Extracts merchant name from description using " - " separator
function extractMerchant(description: string): string | undefined {
  const separatorIndex = description.indexOf(" - ");

  if (separatorIndex === -1) {
    return undefined;
  }

  const merchant = normalizeText(description.slice(0, separatorIndex));
  return merchant || undefined;
}

// Maps DFCC scrape category to OfferCategory using defined rules
function mapCategory(row: RawDfccOffer, description: string): OfferCategory {
  const hasZeroEpp = /0% Easy Payment/i.test(description);
  const hasAnyEpp = hasZeroEpp || /Easy Payment/i.test(description);

  switch (row.category) {
    case "Dining":
      return "dining";
    case "Supermarket":
      return "supermarket";
    case "Travel":
      return "travel";
    case "Online":
      return "online";
    case "Automobile":
      return hasZeroEpp ? "installment" : "other";
    case "Education":
      return hasZeroEpp ? "installment" : "other";
    case "Health & Beauty":
      return hasZeroEpp ? "installment" : categorizeOfferText(description);
    case "Home & Living":
      return hasAnyEpp ? "installment" : "other";
    case "Insurance":
      return hasZeroEpp ? "installment" : "other";
    case "Clothing & Retail": {
      const detected = categorizeOfferText(description);
      return detected === "other" ? "other" : detected;
    }
    case "Entertainment":
      return categorizeOfferText(description);
    case "Jewellery":
      return "other";
    default:
      return categorizeOfferText(description);
  }
}

// Builds a human-readable title for the offer
function buildTitle(row: RawDfccOffer, merchant: string | undefined, category: OfferCategory): string {
  if (category === "installment") {
    return `${merchant ?? normalizeText(getSourceSubject(row).replace(/-/g, " "))} installment plans`;
  }

  if (merchant && row.offer_amount_percent !== null) {
    const prefix = /\bup to\b/i.test(row.offer_about) ? "Up to " : "";
    return `${prefix}${row.offer_amount_percent}% off at ${merchant}`;
  }

  return merchant ?? normalizeText(getSourceSubject(row).replace(/-/g, " "));
}

// Transforms raw DFCC scrape data into normalized ScannedOffer records
export function transformDfccScrape(raw: unknown, reviewDateIso: string): ScannedOffer[] {
  assertRawDfccScrape(raw);

  const reviewDate = getReviewDate(reviewDateIso);

  return raw
    .filter((row) => isActiveRow(row, reviewDate))
    .map((row) => {
      const description = normalizeText(row.offer_about);
      const merchant = extractMerchant(description);
      const category = mapCategory(row, description);

      return {
        bankId: "dfcc",
        id: buildOfferId(row),
        cardId: "dfcc-credit-cards",
        title: buildTitle(row, merchant, category),
        category,
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
