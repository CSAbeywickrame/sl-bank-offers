import { formatDate } from "@/lib/format";
import { getCategoryLabel } from "@/lib/offers/categories";
import type { Bank, Card, Offer, OfferCategory } from "@/lib/offers/types";

export interface PageCopy {
  title: string;
  description: string;
}

// "1 deal" / "2 deals" — keeps every count in the copy grammatical.
export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// Live offer count per bank id.
export function countOffersByBank(offers: Pick<Offer, "bankId">[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const offer of offers) counts.set(offer.bankId, (counts.get(offer.bankId) ?? 0) + 1);
  return counts;
}

// Banks with at least one live offer: the only honest "from N banks" figure for public copy.
export function countBanksWithOffers(banks: Bank[], offers: Pick<Offer, "bankId">[]): number {
  const counts = countOffersByBank(offers);
  return banks.filter((bank) => counts.has(bank.id)).length;
}

// True when the bank has a debit card or any live offer that names debit cards.
export function bankHasDebit(bankId: string, cards: Card[], offers: Offer[]): boolean {
  const debitCard = cards.some(
    (card) => card.bankId === bankId && /debit/i.test(`${card.id} ${card.name}`),
  );
  return debitCard || offers.some((offer) => offer.bankId === bankId && offer.cardTypes?.includes("debit"));
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

// Title and description for a bank page; a bank with no live offers avoids "0 live deals", and
// "debit" is only claimed for banks that actually have debit offers.
export function buildBankCopy(
  bankName: string,
  offerCount: number,
  lastChecked?: string,
  hasDebit = false,
): PageCopy {
  const kind = hasDebit ? "credit and debit card" : "card";
  if (offerCount === 0) {
    return {
      title: `${bankName} Card Offers`,
      description: `${bankName} ${kind} offers in Sri Lanka. There are no live offers right now, so check back after the next weekly refresh.`,
    };
  }
  const checked = lastChecked ? `, last checked ${formatDate(lastChecked, "recently")}` : "";
  return {
    title: `${bankName} Card Offers – ${pluralise(offerCount, "live deal")}`,
    description: `${pluralise(offerCount, `live ${bankName} ${kind} offer`)}${checked}. See which cards qualify, the days they apply and the minimum spend.`,
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
  const checked = lastChecked ? `, last checked ${formatDate(lastChecked, "recently")}` : "";
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

// "8 live offers across 6 banks · best is 25% off" — the summary that tells someone whether a
// merchant page is worth reading before they read it.
export function summariseMerchant(offerCount: number, bankCount: number, bestDiscountPct?: number): string {
  const offers = pluralise(offerCount, "live offer");
  const banks = bankCount > 1 ? ` across ${bankCount} banks` : "";
  const best = bestDiscountPct !== undefined ? ` · best is ${bestDiscountPct}% off` : "";
  return `${offers}${banks}${best}`;
}

// "HNB, Sampath, NDB and Seylan" or, past `max`, "HNB, Sampath, NDB, Seylan and 3 more".
export function listBanks(names: string[], max = 4): string {
  const shown = names.slice(0, max);
  if (names.length > max) return `${shown.join(", ")} and ${names.length - max} more`;
  if (shown.length < 2) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`;
}

// Title and description for a merchant page; counts live in the title only, the description
// names the banks and the best discount.
export function buildMerchantCopy(
  name: string,
  offerCount: number,
  bankNames: string[],
  bestDiscountPct?: number,
): PageCopy {
  const best = bestDiscountPct !== undefined ? ` The best is ${bestDiscountPct}% off.` : "";
  return {
    title: `${name} Card Offers – ${pluralise(offerCount, "deal")} from ${pluralise(bankNames.length, "bank")}`,
    description: `Every bank card offer at ${name} from ${listBanks(bankNames)}, side by side, so you can pick the card that saves most.${best}`,
  };
}
