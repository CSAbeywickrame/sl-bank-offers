import { categorizeOfferText } from "@/lib/ingest/categorize";
import type { OfferCategory, ScannedOffer } from "./types";

interface RawBocOffer {
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
  ["https://www.boc.lk/personal-banking/card-offers/supermarkets/keells/product", "boc-keells-june-2026"],
  ["https://www.boc.lk/personal-banking/card-offers/zero-plans/air-tickets/product", "boc-air-tickets-august-2026"]
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertRawBocOffer(value: unknown): asserts value is RawBocOffer {
  if (
    !isRecord(value) ||
    typeof value.bank !== "string" ||
    typeof value.category !== "string" ||
    (value.offer_amount_percent !== null && typeof value.offer_amount_percent !== "number") ||
    typeof value.offer_about !== "string" ||
    (value.expiry_date !== null && typeof value.expiry_date !== "string") ||
    typeof value.source_url !== "string"
  ) {
    throw new Error("BOC scrape rows must include bank, category, offer_about, expiry_date, and source_url.");
  }
}

function assertRawBocScrape(value: unknown): asserts value is RawBocOffer[] {
  if (!Array.isArray(value)) {
    throw new Error("BOC scrape must be an array.");
  }

  for (const row of value) {
    assertRawBocOffer(row);
  }
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/\u2026/g, "...")
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

function isActiveRow(row: RawBocOffer, reviewDate: string): boolean {
  return row.expiry_date === null || row.expiry_date >= reviewDate;
}

function getSourceSubject(row: RawBocOffer): string {
  const slug = new URL(row.source_url).pathname.split("/").filter(Boolean).slice(-2, -1)[0];
  return slug ?? "offer";
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

function buildOfferId(row: RawBocOffer): string {
  const legacyId = legacyOfferIds.get(row.source_url);
  if (legacyId) {
    return legacyId;
  }

  return `boc-${getSourceSubject(row)}${getExpirySuffix(row.expiry_date)}`;
}

function extractMerchant(description: string): string | undefined {
  const separatorIndex = description.indexOf(" - ");

  if (separatorIndex === -1) {
    return undefined;
  }

  const merchant = normalizeText(description.slice(0, separatorIndex));
  return merchant || undefined;
}

function mapCategory(row: RawBocOffer, description: string, merchant: string | undefined): OfferCategory {
  switch (row.category) {
    case "Dining":
      return "dining";
    case "Supermarkets":
      return "supermarket";
    case "Travel and Leisure":
      return "travel";
    case "Zero Plans":
      return "installment";
    case "VISA Offers":
      if (/\b(taste|dining|food|restaurant)\b/i.test(description)) {
        return "dining";
      }
      if (/\b(singapore|korea|thailand|destination|attractions)\b/i.test(description)) {
        return "travel";
      }
      break;
    default:
      break;
  }

  if (merchant && /\bbeach\b/i.test(merchant)) {
    return "travel";
  }

  const detected = categorizeOfferText(description);
  return detected === "other" ? "other" : detected;
}

function buildTitle(row: RawBocOffer, merchant: string | undefined, category: OfferCategory): string {
  if (category === "installment") {
    return `${merchant ?? normalizeText(getSourceSubject(row).replace(/-/g, " "))} installment plans`;
  }

  if (merchant && row.offer_amount_percent !== null) {
    const prefix = /\bup to\b/i.test(row.offer_about) ? "Up to " : "";
    return `${prefix}${row.offer_amount_percent}% off at ${merchant}`;
  }

  if (merchant && /\bbonus month\b/i.test(row.offer_about)) {
    return `${merchant} bonus month offer`;
  }

  return merchant ?? normalizeText(getSourceSubject(row).replace(/-/g, " "));
}

export function transformBocScrape(raw: unknown, reviewDateIso: string): ScannedOffer[] {
  assertRawBocScrape(raw);

  const reviewDate = getReviewDate(reviewDateIso);

  return raw
    .filter((row) => isActiveRow(row, reviewDate))
    .map((row) => {
      const description = normalizeText(row.offer_about);
      const merchant = extractMerchant(description);
      const category = mapCategory(row, description, merchant);

      return {
        bankId: "boc",
        id: buildOfferId(row),
        cardId: "boc-credit-cards",
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
