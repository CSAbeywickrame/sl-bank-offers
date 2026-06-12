import { categorizeOfferText } from "@/lib/ingest/categorize";
import type { OfferCategory, ScannedOffer } from "./types";

interface RawSampathOffer {
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

function assertRawSampathOffer(value: unknown): asserts value is RawSampathOffer {
  if (
    !isRecord(value) ||
    typeof value.bank !== "string" ||
    typeof value.category !== "string" ||
    (value.offer_amount_percent !== null && typeof value.offer_amount_percent !== "number") ||
    typeof value.offer_about !== "string" ||
    (value.expiry_date !== null && typeof value.expiry_date !== "string") ||
    typeof value.source_url !== "string"
  ) {
    throw new Error("Sampath scrape rows must include bank, category, offer_about, expiry_date, and source_url.");
  }
}

function assertRawSampathScrape(value: unknown): asserts value is RawSampathOffer[] {
  if (!Array.isArray(value)) {
    throw new Error("Sampath scrape must be an array.");
  }

  for (const row of value) {
    assertRawSampathOffer(row);
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

function isActiveRow(row: RawSampathOffer, reviewDate: string): boolean {
  return row.expiry_date === null || row.expiry_date >= reviewDate;
}

function getOfferSummary(description: string): string {
  const summary = description.split(" - Eligible cards:")[0] ?? description;
  return normalizeText(summary.replace(/[;|]+$/g, ""));
}

function getEligibleCards(description: string): string {
  const match = description.match(/Eligible cards:\s*(.+?)(?:\s+-\s+Validity text:|$)/i);
  return normalizeText(match?.[1] ?? "");
}

function getCardId(description: string): string {
  const eligibleCards = getEligibleCards(description).toLowerCase();
  const hasPremiumMarker = /(visa infinite|visa signature|mastercard world|platinum ultramiles|american express)/i.test(eligibleCards);
  const hasStandardMarker =
    /(visa credit|visa debit|visa cards|mastercard(?!\s*world)|credit\s*&\s*debit|credit\/debit|all sampath visa|all sampath mastercard|sampath mastercard\s*&\s*visa|sampath mastercard,\s*visa)/i.test(
      eligibleCards
    );

  return hasPremiumMarker && !hasStandardMarker ? "sampath-premium-credit-cards" : "sampath-credit-cards";
}

function mapCategory(rawCategory: string, description: string): OfferCategory {
  switch (rawCategory) {
    case "Dining":
      return "dining";
    case "Online":
      return "online";
    case "Supermarket":
      return "supermarket";
    case "Travel":
      return "travel";
    case "Electronics & Furniture":
      return /\b(installment|installments|instalment|instalments|0% interest|easy payment|pay later)\b/i.test(description)
        ? "installment"
        : "other";
    default: {
      const detected = categorizeOfferText(description);
      return detected === "other" ? "other" : detected;
    }
  }
}

function extractMerchant(summary: string): string | undefined {
  if (/^(exclusive offers?|exlusice offers?)\b/i.test(summary)) {
    const domainMerchant = summary.match(/\b(?:at|on)\s+((?:www\.)?[a-z0-9-]+\.[a-z]{2,})\b/i);
    return domainMerchant?.[1] ? normalizeText(domainMerchant[1]) : undefined;
  }

  const explicitLead = summary.match(/^(.+?)\s+-\s+(?:Offer(?:\s+\d+)?:|Up to\b|\d|Enjoy\b)/i);
  if (explicitLead?.[1] && !/^offer$/i.test(explicitLead[1])) {
    const merchant = normalizeText(explicitLead[1].replace(/[;|]+$/g, ""));
    if (merchant) {
      return merchant;
    }
  }

  const domainMerchant = summary.match(/\b(?:at|on)\s+((?:www\.)?[a-z0-9-]+\.[a-z]{2,})\b/i);
  if (domainMerchant?.[1]) {
    return normalizeText(domainMerchant[1]) || undefined;
  }

  const offerMerchant = summary.match(/\bat\s+([a-z0-9&'.(),/ -]+?)(?:\s+(?:exclusively|when|for|with|during)\b|;|\s+-\s+|$)/i);
  if (offerMerchant?.[1]) {
    return normalizeText(offerMerchant[1].replace(/\s+and$/i, "")) || undefined;
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
  const match = sourceUrl.match(/\/credit-card-offer\/(\d+)\/?$/);
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

function buildOfferId(row: RawSampathOffer, summary: string, merchant: string | undefined): string {
  const sourceOfferNumber = getSourceOfferNumber(row.source_url);
  const subject = slugify(merchant ?? summary.replace(/^offer\s+-\s*/i, "").replace(/^exclusive offers?\s+for\s+[^-]+-\s*/i, "")).slice(0, 48) || "offer";
  const offerNumberSuffix = sourceOfferNumber ? `-${sourceOfferNumber}` : "";

  return `sampath-${subject}${offerNumberSuffix}${getExpirySuffix(row.expiry_date)}`;
}

function buildTitle(summary: string): string {
  return normalizeText(summary.replace(/^Offer\s+-\s*/i, ""));
}

export function transformSampathScrape(raw: unknown, reviewDateIso: string): ScannedOffer[] {
  assertRawSampathScrape(raw);

  const reviewDate = getReviewDate(reviewDateIso);

  return raw
    .filter((row) => isActiveRow(row, reviewDate))
    .map((row) => {
      const description = normalizeText(row.offer_about);
      const summary = getOfferSummary(description);
      const merchant = extractMerchant(summary);

      return {
        bankId: "sampath",
        id: buildOfferId(row, summary, merchant),
        cardId: getCardId(description),
        title: buildTitle(summary),
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
