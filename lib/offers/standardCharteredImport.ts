import { categorizeOfferText } from "@/lib/ingest/categorize";
import type { OfferCategory, ScannedOffer } from "./types";

interface RawStandardCharteredOffer {
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

function assertRawStandardCharteredOffer(value: unknown): asserts value is RawStandardCharteredOffer {
  if (
    !isRecord(value) ||
    typeof value.bank !== "string" ||
    typeof value.category !== "string" ||
    (value.offer_amount_percent !== null && typeof value.offer_amount_percent !== "number") ||
    typeof value.offer_about !== "string" ||
    (value.expiry_date !== null && typeof value.expiry_date !== "string") ||
    typeof value.source_url !== "string"
  ) {
    throw new Error("Standard Chartered scrape rows must include bank, category, offer_about, expiry_date, and source_url.");
  }
}

function assertRawStandardCharteredScrape(value: unknown): asserts value is RawStandardCharteredOffer[] {
  if (!Array.isArray(value)) {
    throw new Error("Standard Chartered scrape must be an array.");
  }

  for (const row of value) {
    assertRawStandardCharteredOffer(row);
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

function isActiveRow(row: RawStandardCharteredOffer, reviewDate: string): boolean {
  return row.expiry_date === null || row.expiry_date >= reviewDate;
}

function extractMerchant(description: string): string | undefined {
  const separatorIndex = description.indexOf(" - ");

  if (separatorIndex === -1) {
    return undefined;
  }

  const merchant = normalizeText(description.slice(0, separatorIndex));
  return merchant || undefined;
}

function hasInstallmentPlan(description: string): boolean {
  return /\binstallment|instalment\b/i.test(description);
}

function mapCategory(rawCategory: string, description: string): OfferCategory {
  switch (rawCategory) {
    case "Hotels":
      return "travel";
    case "Travel":
      return "travel";
    default:
      break;
  }

  if (hasInstallmentPlan(description)) {
    return "installment";
  }

  const detected = categorizeOfferText(description);
  return detected === "other" ? "other" : detected;
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

function buildOfferId(row: RawStandardCharteredOffer, merchant: string | undefined, description: string): string {
  return `standard-chartered-${slugify(merchant ?? description)}${getExpirySuffix(row.expiry_date)}`;
}

function buildTitle(row: RawStandardCharteredOffer, merchant: string | undefined, description: string): string {
  if (!merchant) {
    return description;
  }

  if (row.offer_amount_percent !== null && hasInstallmentPlan(description)) {
    const prefix = /\bup to\b/i.test(description) ? "Up to " : "";
    return `${prefix}${row.offer_amount_percent}% off and installment plans at ${merchant}`;
  }

  if (row.offer_amount_percent !== null) {
    const prefix = /\bup to\b/i.test(description) ? "Up to " : "";
    return `${prefix}${row.offer_amount_percent}% off at ${merchant}`;
  }

  if (hasInstallmentPlan(description)) {
    return `Installment plans at ${merchant}`;
  }

  return merchant;
}

export function transformStandardCharteredScrape(raw: unknown, reviewDateIso: string): ScannedOffer[] {
  assertRawStandardCharteredScrape(raw);

  const reviewDate = getReviewDate(reviewDateIso);

  return raw
    .filter((row) => isActiveRow(row, reviewDate))
    .map((row) => {
      const description = normalizeText(row.offer_about);
      const merchant = extractMerchant(description);
      const category = mapCategory(row.category, description);

      return {
        bankId: "standard-chartered",
        id: buildOfferId(row, merchant, description),
        cardId: "standard-chartered-credit-cards",
        title: buildTitle(row, merchant, description),
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
