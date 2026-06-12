import { categorizeOfferText } from "@/lib/ingest/categorize";
import type { OfferCategory, ScannedOffer } from "./types";

interface RawUnionBankOffer {
  bank: string;
  category: string;
  offer_amount_percent: number | null;
  offer_about: string;
  expiry_date: string | null;
  source_url: string;
}

const reviewDatePattern = /^\d{4}-\d{2}-\d{2}T/;
const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertRawUnionBankOffer(value: unknown): asserts value is RawUnionBankOffer {
  if (
    !isRecord(value) ||
    typeof value.bank !== "string" ||
    typeof value.category !== "string" ||
    (value.offer_amount_percent !== null && typeof value.offer_amount_percent !== "number") ||
    typeof value.offer_about !== "string" ||
    (value.expiry_date !== null && typeof value.expiry_date !== "string") ||
    typeof value.source_url !== "string"
  ) {
    throw new Error("Union Bank scrape rows must include bank, category, offer_about, expiry_date, and source_url.");
  }
}

function assertRawUnionBankScrape(value: unknown): asserts value is RawUnionBankOffer[] {
  if (!Array.isArray(value)) {
    throw new Error("Union Bank scrape must be an array.");
  }

  for (const row of value) {
    assertRawUnionBankOffer(row);
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

function isActiveRow(row: RawUnionBankOffer, reviewDate: string): boolean {
  return row.expiry_date === null || row.expiry_date >= reviewDate;
}

function hasInstallmentPlan(description: string): boolean {
  return /\binstal(?:l)?ments?\b/i.test(description);
}

function hasCashback(description: string): boolean {
  return /\bcashback\b/i.test(description);
}

function mapCategory(rawCategory: string, description: string): OfferCategory {
  if (hasInstallmentPlan(description)) {
    return "installment";
  }

  if (hasCashback(description)) {
    return "cashback";
  }

  switch (rawCategory) {
    case "Dining":
      return "dining";
    case "Supermarket":
      return "supermarket";
    case "Travel":
      return "travel";
    case "Other":
      return "other";
    default: {
      const detected = categorizeOfferText(description);
      return detected === "other" ? "other" : detected;
    }
  }
}

function extractMerchant(description: string): string | undefined {
  if (description.startsWith("0% - ")) {
    const remainder = description.slice(5);
    const separatorIndex = remainder.indexOf(" - ");
    return normalizeText(separatorIndex === -1 ? remainder : remainder.slice(0, separatorIndex)) || undefined;
  }

  const boundaryPatterns = [
    /\s+-\s+(?:Up to\s+)?\d+(?:\.\d+)?%/i,
    /\s+-\s+Father'?s Day\b/i,
    /\s+-\s+convert\b/i,
    /\s+-\s+'/i
  ];

  let boundaryIndex = description.length;

  for (const pattern of boundaryPatterns) {
    const match = pattern.exec(description);
    if (match && match.index < boundaryIndex) {
      boundaryIndex = match.index;
    }
  }

  const merchant = normalizeText(description.slice(0, boundaryIndex));
  return merchant || undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
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

function buildOfferId(row: RawUnionBankOffer, merchant: string | undefined): string {
  return `union-bank-${slugify(merchant ?? row.source_url)}${getExpirySuffix(row.expiry_date)}`;
}

function buildTitle(row: RawUnionBankOffer, merchant: string | undefined, category: OfferCategory, description: string): string {
  if (category === "installment") {
    return `${merchant ?? "Union Bank"} installment plans`;
  }

  if (category === "cashback" && row.offer_amount_percent !== null) {
    if (/\bfuel\b/i.test(description)) {
      return `${row.offer_amount_percent}% cashback on fuel transactions`;
    }

    return `${row.offer_amount_percent}% cashback with ${merchant ?? "Union Bank Credit Cards"}`;
  }

  if (merchant && row.offer_amount_percent !== null) {
    const prefix = /\bup to\b/i.test(description) ? "Up to " : "";
    return `${prefix}${row.offer_amount_percent}% off at ${merchant}`;
  }

  return merchant ?? description;
}

export function transformUnionBankScrape(raw: unknown, reviewDateIso: string): ScannedOffer[] {
  assertRawUnionBankScrape(raw);

  const reviewDate = getReviewDate(reviewDateIso);

  return raw
    .filter((row) => isActiveRow(row, reviewDate))
    .map((row) => {
      const description = normalizeText(row.offer_about);
      const merchant = extractMerchant(description);
      const category = mapCategory(row.category, description);

      return {
        bankId: "union-bank",
        id: buildOfferId(row, merchant),
        cardId: "union-bank-credit-cards",
        title: buildTitle(row, merchant, category, description),
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
