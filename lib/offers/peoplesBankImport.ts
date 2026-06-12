import { categorizeOfferText } from "@/lib/ingest/categorize";
import type { OfferCategory, ScannedOffer } from "./types";

interface RawPeoplesBankOffer {
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
  ["https://www.peoplesbank.lk/promotion/keells-25-off-credit/", "peoples-bank-keells-june-2026"],
  ["https://www.peoplesbank.lk/promotion/plates-at-cinnamon-grand-colombo-30-off-credit/", "peoples-bank-plates-june-2026"]
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertRawPeoplesBankOffer(value: unknown): asserts value is RawPeoplesBankOffer {
  if (
    !isRecord(value) ||
    typeof value.bank !== "string" ||
    typeof value.category !== "string" ||
    (value.offer_amount_percent !== null && typeof value.offer_amount_percent !== "number") ||
    typeof value.offer_about !== "string" ||
    (value.expiry_date !== null && typeof value.expiry_date !== "string") ||
    typeof value.source_url !== "string"
  ) {
    throw new Error("People's Bank scrape rows must include bank, category, offer_about, expiry_date, and source_url.");
  }
}

function assertRawPeoplesBankScrape(value: unknown): asserts value is RawPeoplesBankOffer[] {
  if (!Array.isArray(value)) {
    throw new Error("People's Bank scrape must be an array.");
  }

  for (const row of value) {
    assertRawPeoplesBankOffer(row);
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

function isActiveRow(row: RawPeoplesBankOffer, reviewDate: string): boolean {
  return row.expiry_date === null || row.expiry_date >= reviewDate;
}

function mapCategory(rawCategory: string, description: string): OfferCategory {
  switch (rawCategory) {
    case "Dining":
      return "dining";
    case "Installments":
      return "installment";
    case "Online":
      return "online";
    case "Supermarket":
      return "supermarket";
    case "Travel":
      return "travel";
    default: {
      const detected = categorizeOfferText(description);
      return detected === "other" ? "other" : detected;
    }
  }
}

function extractMerchant(description: string, category: string): string | undefined {
  if (category === "Installments") {
    const match = description.match(/^(.+?) installment plan\b/i);
    return match ? normalizeText(match[1] ?? "") || undefined : undefined;
  }

  const boundaryPatterns = [
    /\s+-\s+(?:Up to\s+)?\d+(?:\.\d+)?%/i,
    /\s+-\s+Maximum\b/i,
    /\s+-\s+Max\.?\b/i,
    /\s+-\s+Minimum\b/i,
    /\s+-\s+The maximum\b/i,
    /\s+-\s+Valid\b/i,
    /\s+-\s+For\b/i,
    /\s+-\s+Stay\b/i,
    /\s+-\s+Booking\b/i,
    /\s+-\s+Travel\b/i,
    /\s+-\s+On Base Fare\b/i,
    /\s+-\s+Not Applicable\b/i,
    /\s+-\s+Food only\b/i,
    /\s+-\s+o\b/i,
    /\s+-\s+Excluding\b/i,
    /\s+-\s+Applicable\b/i,
    /\s+-\s+Orders\b/i,
    /\s+-\s+One\b/i,
    /\s+-\s+Blackout\b/i,
    /\s+-\s+View Promotion Details\b/i,
    /\s+View Promotion Details\b/i,
    /\s+Promo Code\b/i
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

function getSourceSubject(row: RawPeoplesBankOffer): string {
  const url = new URL(row.source_url);
  const fragment = normalizeText(url.hash.replace(/^#/, ""));

  if (fragment) {
    return `${slugify(fragment)}-installments`;
  }

  const slug = url.pathname.split("/").filter(Boolean).pop() ?? "offer";
  return slug
    .replace(/-(?:credit|debit)$/i, "")
    .replace(/^www-/i, "")
    .replace(/-(?:com|lk)-/gi, "-")
    .replace(/-(?:com|lk)$/i, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
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

function buildOfferId(row: RawPeoplesBankOffer): string {
  const legacyId = legacyOfferIds.get(row.source_url);
  if (legacyId) {
    return legacyId;
  }

  return `peoples-bank-${getSourceSubject(row)}${getExpirySuffix(row.expiry_date)}`;
}

function buildTitle(row: RawPeoplesBankOffer, merchant: string | undefined): string {
  if (row.category === "Installments") {
    return `${merchant ?? "Installment"} installment plans`;
  }

  if (merchant && row.offer_amount_percent !== null) {
    const prefix = /\bup to\b/i.test(row.offer_about) ? "Up to " : "";
    return `${prefix}${row.offer_amount_percent}% off at ${merchant}`;
  }

  if (merchant) {
    return merchant;
  }

  return normalizeText(getSourceSubject(row).replace(/-/g, " "));
}

export function transformPeoplesBankScrape(raw: unknown, reviewDateIso: string): ScannedOffer[] {
  assertRawPeoplesBankScrape(raw);

  const reviewDate = getReviewDate(reviewDateIso);

  return raw
    .filter((row) => isActiveRow(row, reviewDate))
    .map((row) => {
      const description = normalizeText(row.offer_about);
      const merchant = extractMerchant(description, row.category);

      return {
        bankId: "peoples-bank",
        id: buildOfferId(row),
        cardId: "peoples-bank-credit-cards",
        title: buildTitle(row, merchant),
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
