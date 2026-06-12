import { categorizeOfferText } from "@/lib/ingest/categorize";
import type { OfferCategory, ScannedOffer } from "./types";

interface RawSeylanOffer {
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

function assertRawSeylanOffer(value: unknown): asserts value is RawSeylanOffer {
  if (
    !isRecord(value) ||
    typeof value.bank !== "string" ||
    typeof value.category !== "string" ||
    (value.offer_amount_percent !== null && typeof value.offer_amount_percent !== "number") ||
    typeof value.offer_about !== "string" ||
    (value.expiry_date !== null && typeof value.expiry_date !== "string") ||
    typeof value.source_url !== "string"
  ) {
    throw new Error("Seylan Bank scrape rows must include bank, category, offer_about, expiry_date, and source_url.");
  }
}

function assertRawSeylanScrape(value: unknown): asserts value is RawSeylanOffer[] {
  if (!Array.isArray(value)) {
    throw new Error("Seylan Bank scrape must be an array.");
  }

  for (const row of value) {
    assertRawSeylanOffer(row);
  }
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‐-―]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getReviewDate(reviewDateIso: string): string {
  if (!reviewDatePattern.test(reviewDateIso)) {
    throw new Error(`Review date must be an ISO timestamp: ${reviewDateIso}`);
  }

  return reviewDateIso.slice(0, 10);
}

function isActiveRow(row: RawSeylanOffer, reviewDate: string): boolean {
  return row.expiry_date === null || row.expiry_date >= reviewDate;
}

function hasInstallmentPlan(description: string): boolean {
  return /\binstal(?:l)?ments?\b/i.test(description);
}

function hasCashback(description: string): boolean {
  return /\bcash\s*back\b/i.test(description);
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
    case "Installment":
      return "installment";
    case "Fuel":
      return "fuel";
    default: {
      const detected = categorizeOfferText(description);
      return detected === "other" ? "other" : detected;
    }
  }
}

function extractMerchant(description: string): string | undefined {
  const separatorIndex = description.indexOf(" - ");
  if (separatorIndex === -1) {
    return normalizeText(description) || undefined;
  }

  const merchant = normalizeText(description.slice(0, separatorIndex));
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

function extractSourceSlug(sourceUrl: string): string {
  const lastSegment = sourceUrl.split("/").filter(Boolean).pop() ?? sourceUrl;
  return slugify(lastSegment);
}

function buildOfferId(row: RawSeylanOffer): string {
  return `seylan-${extractSourceSlug(row.source_url)}${getExpirySuffix(row.expiry_date)}`;
}

function buildTitle(row: RawSeylanOffer, merchant: string | undefined, category: OfferCategory, description: string): string {
  if (category === "installment") {
    return `${merchant ?? "Seylan Bank"} installment plans`;
  }

  if (category === "cashback" && row.offer_amount_percent !== null) {
    if (/\bfuel\b/i.test(description)) {
      return `${row.offer_amount_percent}% cashback on fuel transactions`;
    }

    return `${row.offer_amount_percent}% cashback with ${merchant ?? "Seylan Credit Cards"}`;
  }

  if (merchant && row.offer_amount_percent !== null) {
    const prefix = /\bup to\b/i.test(description) ? "Up to " : "";
    return `${prefix}${row.offer_amount_percent}% off at ${merchant}`;
  }

  return merchant ?? description;
}

export function transformSeylanScrape(raw: unknown, reviewDateIso: string): ScannedOffer[] {
  assertRawSeylanScrape(raw);

  const reviewDate = getReviewDate(reviewDateIso);

  return raw
    .filter((row) => isActiveRow(row, reviewDate))
    .map((row) => {
      const description = normalizeText(row.offer_about);
      const merchant = extractMerchant(description);
      const category = mapCategory(row.category, description);

      return {
        bankId: "seylan",
        id: buildOfferId(row),
        cardId: "seylan-credit-cards",
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
