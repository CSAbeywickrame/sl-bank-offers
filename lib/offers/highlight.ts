import type { Offer } from "./types";

/**
 * The one number a shopper scans for.
 *
 * Every offer gets a headline, because a card with an empty badge is worse than one with an honest
 * small label. What that headline IS depends on what the offer sells: only 60% of the catalog has
 * a percentage off, and a third is interest-free instalment plans where the TERM is the offer and
 * a percentage would be meaningless.
 *
 * Card and detail page both read this so they can never disagree about what an offer is worth.
 */
export interface OfferHighlight {
  /** Large scannable figure, e.g. "25%" or "36". Absent when the offer has no number to lead with. */
  value?: string;
  /** Qualifier under the value, e.g. "off" or "months 0%". Stands alone when there is no value. */
  label: string;
  /** True for a real discount percentage, which the UI may style more prominently. */
  isDiscount: boolean;
}

const OFFER_TYPE_LABELS: Record<string, string> = {
  installment: "Instalment plan",
  cashback: "Cashback",
  bogo: "Buy 1 get 1",
  discount: "Special offer",
  other: "Special offer"
};

export function getOfferHighlight(offer: Offer): OfferHighlight {
  if (typeof offer.discountPct === "number") {
    return { value: `${formatPct(offer.discountPct)}%`, label: "off", isDiscount: true };
  }
  // An instalment plan's headline is its tenure. "36 / months 0%" tells a shopper more than the
  // "0%" alone ever could, and 94% of these offers state a term.
  if (typeof offer.installmentMonths === "number") {
    return { value: String(offer.installmentMonths), label: "months 0%", isDiscount: false };
  }
  // Whatever the bank called it, when a bare percentage could not express the deal.
  if (offer.discountLabel?.trim()) {
    return { label: offer.discountLabel.trim(), isDiscount: false };
  }
  return { label: OFFER_TYPE_LABELS[offer.offerType ?? "other"] ?? "Special offer", isDiscount: false };
}

// Whole numbers stay whole ("25%", not "25.0%"); a real fraction keeps one decimal.
function formatPct(pct: number): string {
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

const WEEKDAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun"
};

/** "Mon-Fri" for a run of consecutive days, "Fri, Sat" otherwise. Undefined when unrestricted. */
export function formatValidDays(days: Offer["validDays"]): string | undefined {
  if (!days || days.length === 0) return undefined;
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const indexes = days.map((day) => order.indexOf(day)).sort((a, b) => a - b);
  const consecutive = indexes.every((value, i) => i === 0 || value === indexes[i - 1] + 1);
  if (consecutive && indexes.length > 2) {
    return `${WEEKDAY_LABELS[order[indexes[0]]]}–${WEEKDAY_LABELS[order[indexes[indexes.length - 1]]]}`;
  }
  return indexes.map((i) => WEEKDAY_LABELS[order[i]]).join(", ");
}

/** "Credit · Visa · Infinite" — which cards an offer actually applies to. Undefined when it says nothing. */
export function formatCardEligibility(offer: Offer): string | undefined {
  const parts = [
    ...(offer.cardTypes ?? []).map(capitalise),
    ...(offer.cardNetworks ?? []).map(formatNetwork),
    ...(offer.cardTiers ?? []).map(capitalise)
  ];
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatNetwork(network: string): string {
  if (network === "amex") return "Amex";
  if (network === "jcb") return "JCB";
  if (network === "unionpay") return "UnionPay";
  return capitalise(network);
}

/** Rupee amount as "Rs. 5,000". */
export function formatLkr(amount: number): string {
  return `Rs. ${new Intl.NumberFormat("en-LK").format(amount)}`;
}
