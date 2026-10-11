import { getCategoryLabel } from "@/lib/offers/categories";
import type { OfferCategory } from "@/lib/offers/types";

export interface PageCopy {
  title: string;
  description: string;
}

// "1 deal" / "2 deals" — keeps every count in the copy grammatical.
export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// Formats an ISO timestamp the way the rest of the site shows dates ("Aug 23, 2026").
export function formatCheckedDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date)
    : "recently";
}

// Default site description; the bank count is passed in so it can never go stale.
export function buildSiteDescription(bankCount: number): string {
  return `Every live credit and debit card offer from ${bankCount} Sri Lankan banks in one place: dining, hotels, supermarkets, fuel and more. Checked weekly, with a link to each bank's terms.`;
}

// Latest lastCheckedAt among the given offers, or undefined when none carry one.
export function latestCheckedAt(offers: { lastCheckedAt?: string }[]): string | undefined {
  return offers
    .map((offer) => offer.lastCheckedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

// Title and description for a bank page; a bank with no live offers avoids "0 live deals".
export function buildBankCopy(bankName: string, offerCount: number, lastChecked?: string): PageCopy {
  if (offerCount === 0) {
    return {
      title: `${bankName} Card Offers`,
      description: `${bankName} credit and debit card offers in Sri Lanka. There are no live offers right now, so check back after the next weekly refresh.`,
    };
  }
  const checked = lastChecked ? `, last checked ${formatCheckedDate(lastChecked)}` : "";
  return {
    title: `${bankName} Card Offers – ${pluralise(offerCount, "live deal")}`,
    description: `${pluralise(offerCount, `live ${bankName} credit and debit card offer`)}${checked}. See which cards qualify, the days they apply and the minimum spend.`,
  };
}

// One visible intro line for a bank page, e.g. "12 offers, mostly Dining and Fuel, last checked Aug 23, 2026."
export function buildBankIntro(
  offerCount: number,
  topCategories: OfferCategory[],
  lastChecked?: string,
): string {
  if (offerCount === 0) return "No live offers right now.";
  // "mostly Other" says nothing, so the catch-all bucket never leads the sentence.
  const labels = topCategories.filter((category) => category !== "other").slice(0, 2).map(getCategoryLabel);
  const mostly = labels.length > 0 ? `, mostly ${labels.join(" and ")}` : "";
  const checked = lastChecked ? `, last checked ${formatCheckedDate(lastChecked)}` : "";
  return `${pluralise(offerCount, "offer")}${mostly}${checked}.`;
}

// Title and description for a category page; no sort claim because the default sort is relevance.
export function buildCategoryCopy(label: string, offerCount: number, bankCount: number): PageCopy {
  if (offerCount === 0) {
    return {
      title: `${label} Card Offers in Sri Lanka`,
      description: `Compare ${label.toLowerCase()} card offers from Sri Lankan banks. There are no live offers in this category right now.`,
    };
  }
  return {
    title: `${label} Card Offers in Sri Lanka – ${pluralise(offerCount, "deal")}`,
    description: `Compare ${pluralise(offerCount, `${label.toLowerCase()} card offer`)} from ${pluralise(bankCount, "Sri Lankan bank")}.`,
  };
}

// Title and description for a merchant page; `summary` is the page's existing one-line stats.
export function buildMerchantCopy(
  name: string,
  offerCount: number,
  bankCount: number,
  summary: string,
): PageCopy {
  return {
    title: `${name} Card Offers – ${pluralise(offerCount, "deal")} from ${pluralise(bankCount, "bank")}`,
    description: `Every bank card offer at ${name}, side by side, so you can pick the card that saves most. ${summary}.`,
  };
}
