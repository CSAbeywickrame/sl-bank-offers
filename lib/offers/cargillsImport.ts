import { categorizeOfferText } from "@/lib/ingest/categorize";
import type { OfferCategory, ScannedOffer } from "./types";

interface RawCargillsOffer {
  bank: string;
  category: string;
  offer_amount_percent: number | null;
  offer_about: string;
  expiry_date: string | null;
  source_url: string;
}

const reviewDatePattern = /^\d{4}-\d{2}-\d{2}T/;
const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const skippedSourceUrls = new Set([
  "https://www.cargillsbank.com/wp-content/uploads/2018/04/Araliya-Hotels-Offer-Terms-Conditions.pdf"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertRawCargillsOffer(value: unknown): asserts value is RawCargillsOffer {
  if (
    !isRecord(value) ||
    typeof value.bank !== "string" ||
    typeof value.category !== "string" ||
    (value.offer_amount_percent !== null && typeof value.offer_amount_percent !== "number") ||
    typeof value.offer_about !== "string" ||
    (value.expiry_date !== null && typeof value.expiry_date !== "string") ||
    typeof value.source_url !== "string"
  ) {
    throw new Error("Cargills Bank scrape rows must include bank, category, offer_about, expiry_date, and source_url.");
  }
}

function assertRawCargillsScrape(value: unknown): asserts value is RawCargillsOffer[] {
  if (!Array.isArray(value)) {
    throw new Error("Cargills Bank scrape must be an array.");
  }

  for (const row of value) {
    assertRawCargillsOffer(row);
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

function isActiveRow(row: RawCargillsOffer, reviewDate: string): boolean {
  if (skippedSourceUrls.has(row.source_url)) {
    return false;
  }

  return row.expiry_date === null || row.expiry_date >= reviewDate;
}

function hasInstallmentPlan(description: string): boolean {
  return /\b(?:0%\s*)?instal(?:l)?ment|emi plan\b/i.test(description);
}

function mapCategory(rawCategory: string, description: string): OfferCategory {
  switch (rawCategory) {
    case "Dining":
      return "dining";
    case "Supermarket":
      return "supermarket";
    case "Travel":
      return "travel";
    case "Online":
      return "online";
    case "Entertainment":
      return "other";
    case "Other":
      if (hasInstallmentPlan(description)) {
        return "installment";
      }
      return "other";
    default: {
      const detected = categorizeOfferText(description);
      return detected === "other" ? "other" : detected;
    }
  }
}

function stripWebsiteSuffix(value: string): string {
  return value.replace(/\s*\((?:https?:\/\/|www\.)[^)]+\)/gi, "");
}

function isMerchantBoundaryStart(value: string): boolean {
  return /^(?:up to\s+)?\d+(?:\.\d+)?%/i.test(value) ||
    /^(?:0%\s+interest|Equal Monthly Instalment plan|transfer outstanding balances|Cargills Bank Mastercard Credit Cardholders|golf privileges)/i.test(value);
}

function extractMerchant(description: string): string | undefined {
  const parts = description.split(" - ").map((part) => normalizeText(part));

  if (parts.length === 0) {
    return undefined;
  }

  if (parts.length === 1 || isMerchantBoundaryStart(parts[1] ?? "")) {
    const merchant = normalizeText(stripWebsiteSuffix(parts[0] ?? ""));
    return merchant || undefined;
  }

  if (parts.length >= 3 && isMerchantBoundaryStart(parts[2] ?? "")) {
    const merchant = normalizeText(stripWebsiteSuffix(`${parts[0]} - ${parts[1]}`));
    return merchant || undefined;
  }

  const merchant = normalizeText(stripWebsiteSuffix(parts[0] ?? ""));
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

function buildOfferId(row: RawCargillsOffer, merchant: string | undefined): string {
  return `cargills-bank-${slugify(merchant ?? row.source_url)}${getExpirySuffix(row.expiry_date)}`;
}

function buildTitle(row: RawCargillsOffer, merchant: string | undefined, category: OfferCategory, description: string): string {
  if (category === "installment") {
    return `${merchant ?? "Cargills Bank"} installment plans`;
  }

  if (merchant && row.offer_amount_percent !== null && hasInstallmentPlan(description)) {
    const prefix = /\bup to\b/i.test(description) ? "Up to " : "";
    return `${prefix}${row.offer_amount_percent}% off and installment plans at ${merchant}`;
  }

  if (merchant && row.offer_amount_percent !== null) {
    const prefix = /\bup to\b/i.test(description) ? "Up to " : "";
    return `${prefix}${row.offer_amount_percent}% off at ${merchant}`;
  }

  return merchant ?? description;
}

export function transformCargillsScrape(raw: unknown, reviewDateIso: string): ScannedOffer[] {
  assertRawCargillsScrape(raw);

  const reviewDate = getReviewDate(reviewDateIso);

  return raw
    .filter((row) => isActiveRow(row, reviewDate))
    .map((row) => {
      const description = normalizeText(row.offer_about);
      const merchant = extractMerchant(description);
      const category = mapCategory(row.category, description);

      return {
        bankId: "cargills-bank",
        id: buildOfferId(row, merchant),
        cardId: "cargills-bank-mastercard-credit-cards",
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
