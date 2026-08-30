import {
  cardKinds,
  cardTierValues,
  weekdays,
  type CardKind,
  type CardNetwork,
  type CardTier,
  type OfferType,
  type ScannedOffer,
  type Weekday
} from "@/lib/offers/types";

/**
 * Regex enrichment for offer text.
 *
 * Every bank states its terms in prose ("25% off, minimum spend Rs. 5,000, Monday to Friday"), so
 * the structured fields have to be parsed back out of the title/description. These parsers are
 * deliberately conservative: a missed field is a blank the UI can hide, whereas a wrong one is a
 * wrong promise to a cardholder. Each parser is exported so it can be unit-tested on its own.
 */

// A percentage plus the words that follow it. The trailing capture is what tells a discount apart
// from a financing rate; letters/dots/spaces only, so it can never swallow the next percentage.
const PERCENT_PATTERN = /(\d{1,3}(?:\.\d+)?)\s*%\s*([a-z.\s]{0,24})/gi;

// A percentage followed by financing wording is a rate or a fee, not a discount: "0% interest",
// "0% installment plans", "1.5% p.a.", "a fee of 1.2% p.m.", "1.2% per month" must never become
// discountPct. `p\.?\s?[am]\b` covers both "p.a." and "p.m." while the boundary stops it matching
// an ordinary word that merely starts with those letters ("25% paid back").
const FINANCING_CONTEXT =
  /^(?:p\.?\s?[am]\b|per\s+(?:month|annum)|interest|instal+ment|easy\s*payment|monthly|plan|fee)/i;

// Highest advertised discount percentage in the text, or undefined when there is none.
export function parseDiscountPct(text: string): number | undefined {
  let best: number | undefined;
  for (const match of text.matchAll(PERCENT_PATTERN)) {
    const value = Number(match[1]);
    // 0% is always financing or a fee waiver, never a discount; >100% is a parse artefact.
    if (!Number.isFinite(value) || value < 1 || value > 100) continue;
    if (FINANCING_CONTEXT.test(match[2])) continue;
    if (best === undefined || value > best) best = value;
  }
  return best;
}

// instal+ment matches both spellings: "instalment" (British, used by some banks) and "installment".
const INSTALLMENT_PATTERN = /instal+ment|easy payment plan|0%\s*(?:interest|payment|plan)/i;
const CASHBACK_PATTERN = /cash\s?back/i;
const BOGO_PATTERN = /\b(?:bogo|buy\s*(?:one|1)\s*get\s*(?:one|1))\b/i;
const DISCOUNT_WORD_PATTERN = /%\s*(?:off|discount|savings?)/i;

// Classifies how the offer pays out. Checked in priority order: an installment plan that also
// quotes a percentage is still an installment offer.
export function inferOfferType(text: string, discountPct: number | undefined): OfferType {
  if (INSTALLMENT_PATTERN.test(text)) return "installment";
  if (CASHBACK_PATTERN.test(text)) return "cashback";
  if (BOGO_PATTERN.test(text)) return "bogo";
  if (discountPct !== undefined || DISCOUNT_WORD_PATTERN.test(text)) return "discount";
  return "other";
}

// Day tokens accepted per weekday: abbreviation, full name, and the plural of either
// ("Fri", "Friday", "Fridays"). Order matches the `weekdays` const.
const DAY_TOKEN_SOURCES = [
  "mon(?:day)?s?",
  "tue(?:s(?:day)?)?s?",
  "wed(?:nesday)?s?",
  "thu(?:r(?:s(?:day)?)?)?s?",
  "fri(?:day)?s?",
  "sat(?:urday)?s?",
  "sun(?:day)?s?"
].join("|");

// Word boundaries keep day names from matching inside other words ("sunglasses", "satisfaction").
const DAY_NAME_PATTERN = new RegExp(`\\b(${DAY_TOKEN_SOURCES})\\b`, "gi");

// "Mon-Fri", "Mon – Fri", "Monday to Friday". The worded separators require surrounding spaces so
// they cannot fire on a word that merely starts with them.
const RANGE_SEPARATOR = "(?:\\s*[-–—]\\s*|\\s+(?:to|through|till|until)\\s+)";
const DAY_RANGE_PATTERN = new RegExp(`\\b(${DAY_TOKEN_SOURCES})${RANGE_SEPARATOR}(${DAY_TOKEN_SOURCES})\\b`, "gi");

const WEEKEND_PATTERN = /\bweek\s?ends?\b/i;
const WEEKDAY_PATTERN = /\bweek\s?days?\b/i;
const WEEKEND_DAYS: Weekday[] = ["sat", "sun"];
const WEEKDAY_DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

// Resolves a matched day token to its weekday: every accepted token starts with the abbreviation.
function toWeekday(token: string): Weekday | undefined {
  const abbreviation = token.slice(0, 3).toLowerCase();
  return weekdays.find((day) => day === abbreviation);
}

// Expands an inclusive day range, wrapping across the end of the week ("Sat-Mon" = sat, sun, mon).
function expandDayRange(start: Weekday, end: Weekday): Weekday[] {
  const startIndex = weekdays.indexOf(start);
  const length = ((weekdays.indexOf(end) - startIndex + 7) % 7) + 1;
  return Array.from({ length }, (_, offset) => weekdays[(startIndex + offset) % 7]);
}

// Days the offer runs on, in mon-to-sun order, or undefined when the text carries no day signal.
export function parseValidDays(text: string): Weekday[] | undefined {
  const days = new Set<Weekday>();

  for (const match of text.matchAll(DAY_RANGE_PATTERN)) {
    const start = toWeekday(match[1]);
    const end = toWeekday(match[2]);
    if (start && end) {
      for (const day of expandDayRange(start, end)) days.add(day);
    }
  }
  // Standalone names run after ranges: they re-match the range endpoints, which the set absorbs.
  for (const match of text.matchAll(DAY_NAME_PATTERN)) {
    const day = toWeekday(match[1]);
    if (day) days.add(day);
  }

  // "Weekday"/"weekend" only supply days when the text named none itself. Copy routinely pairs the
  // generic word with the precise range it means — "Weekday Discount ... for weekday stays
  // (Sun-Thu)" — and unioning the two would add the Friday that offer explicitly excludes.
  if (days.size === 0) {
    if (WEEKEND_PATTERN.test(text)) {
      for (const day of WEEKEND_DAYS) days.add(day);
    }
    if (WEEKDAY_PATTERN.test(text)) {
      for (const day of WEEKDAY_DAYS) days.add(day);
    }
  }

  const ordered = weekdays.filter((day) => days.has(day));
  // All seven days is not a restriction — it is an offer that runs every day, which the absent
  // field already says. Returning it would make a Friday filter look like it had a real signal.
  if (ordered.length === 0 || ordered.length === weekdays.length) return undefined;
  return ordered;
}

// A rupee amount: currency token, then a comma-grouped number ("Rs. 5,000", "LKR 4,000", "Rs.1250").
// A scale word is pulled into the same capture group so "Rs. 1 Million" reads as 1000000 rather
// than 1, and so every pattern below keeps the amount in group 1.
const AMOUNT = "(?:rs|lkr)\\.?\\s*([\\d,]+(?:\\.\\d+)?(?:\\s*(?:mn|million|bn|billion)\\b)?)";
// Gap between the qualifier and the amount. Digits and dots are excluded so a match can never jump
// a sentence boundary or another number to reach an unrelated figure.
const AMOUNT_GAP = "[^.\\d]{0,40}?";

// "minimum spend of Rs. 5,000", "min. bill LKR 4,000", "Min Rs.4,000".
const MIN_SPEND_PATTERN = new RegExp(`\\bmin(?:imum)?\\b\\.?${AMOUNT_GAP}${AMOUNT}`, "i");
// "spend Rs 10,000 or more". The trailing qualifier is required: a bare "spend Rs 10,000" is
// usually an example, not a threshold.
const SPEND_OR_MORE_PATTERN = new RegExp(`\\bspend\\s*(?:of\\s*)?${AMOUNT}\\s*(?:or|and)\\s*(?:more|above|over)`, "i");

// A bare "maximum" is not a cap on the saving — banks use it for transaction ceilings too
// ("Minimum transaction Rs. 10,000 and maximum Rs. 1 Million"), which would otherwise be published
// as the discount cap. So a saving word is required on one side of the "maximum".
const SAVING_WORD = "(?:discount|saving|benefit|rebate|waiver|cash\\s?back|off)";

// "maximum discount of Rs. 1,250", "max saving LKR 2,000".
const MAX_THEN_SAVING_PATTERN = new RegExp(
  `\\bmax(?:imum)?\\b\\.?\\s*${SAVING_WORD}[^.\\d]{0,24}?${AMOUNT}`,
  "i"
);
// "discount up to a maximum of Rs. 5,000" — the same cap with the words the other way round.
const SAVING_THEN_MAX_PATTERN = new RegExp(
  `${SAVING_WORD}[^.\\d]{0,32}?\\bmax(?:imum)?\\b\\.?[^.\\d]{0,24}?${AMOUNT}`,
  "i"
);
// "capped at Rs 3,000".
const CAPPED_AT_PATTERN = new RegExp(`\\bcapped\\s+at\\s*${AMOUNT}`, "i");

const AMOUNT_SCALES: Array<{ pattern: RegExp; multiplier: number }> = [
  { pattern: /\b(?:mn|million)\b/i, multiplier: 1_000_000 },
  { pattern: /\b(?:bn|billion)\b/i, multiplier: 1_000_000_000 }
];

// Parses a comma-grouped rupee amount, with an optional scale word, into a positive integer — or
// undefined when it is unusable.
function toAmount(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const scale = AMOUNT_SCALES.find(({ pattern }) => pattern.test(raw));
  const value = Number(raw.replace(/,/g, "").replace(/[a-z\s]+$/i, ""));
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value * (scale?.multiplier ?? 1));
}

// Returns the amount captured by the first pattern that matches the text.
function firstAmount(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const amount = toAmount(text.match(pattern)?.[1]);
    if (amount !== undefined) return amount;
  }
  return undefined;
}

// Minimum spend required to unlock the offer, in LKR.
export function parseMinSpend(text: string): number | undefined {
  return firstAmount(text, [MIN_SPEND_PATTERN, SPEND_OR_MORE_PATTERN]);
}

// Cap on how much the offer can save, in LKR.
export function parseMaxDiscountAmount(text: string): number | undefined {
  return firstAmount(text, [MAX_THEN_SAVING_PATTERN, SAVING_THEN_MAX_PATTERN, CAPPED_AT_PATTERN]);
}

// Ordered per the `cardNetworks` const so results come back in a stable order.
const CARD_NETWORK_PATTERNS: Array<{ network: CardNetwork; pattern: RegExp }> = [
  { network: "visa", pattern: /\bvisa\b/i },
  { network: "mastercard", pattern: /\bmaster\s?cards?\b/i },
  { network: "amex", pattern: /\b(?:amex|american\s+express)\b/i },
  { network: "unionpay", pattern: /\bunion\s?pay\b/i },
  { network: "jcb", pattern: /\bjcb\b/i },
  { network: "diners", pattern: /\bdiners\b/i }
];

// A card noun: "card", "cards", "cardholder(s)", "cardmember(s)". The leading boundary keeps it
// from matching the tail of "Mastercard".
const CARD_NOUN = "\\bcard(?:s|holders?|members?)?\\b";

// Kinds only count in card context, and within a short window, so "credit and debit cardholders"
// tags both while a stray "credit" in prose tags neither.
const CARD_KIND_PATTERNS: Array<{ kind: CardKind; pattern: RegExp }> = cardKinds.map((kind) => ({
  kind,
  pattern: new RegExp(`\\b${kind}\\b[^.]{0,20}?${CARD_NOUN}`, "i")
}));

// Every tier name doubles as ordinary English somewhere in this catalog ("gold jewellery",
// "world-renowned brands", "Platinum tier at 850+ hotels", "premium offers"), so a bare word match
// is never enough — each needs a card noun downstream. The window is wide enough to span the
// enumerations banks actually write ("Platinum, Signature and Infinite credit cardholders") and
// stops at a sentence boundary so it cannot bridge two unrelated offers in one description.
const TIER_CARD_CONTEXT_WINDOW = 60;

// "Gold" still collides inside the window, because jewellery offers name the metal and the eligible
// card in the same sentence. Blocking the metal senses outright is safe: a card is never "gold
// jewellery" or "gold plated".
const GOLD_NON_CARD_SENSE = "(?!\\s+(?:jewell?er|plated|coins?\\b|bars?\\b))";

// "Premium" is too common in ordinary offer copy for any window at all — "insurance premium
// payments with Seylan Credit Card" and "premium medical care ... for ComBank Cardholders" both
// sit well inside 60 characters of a card noun while being open to every cardholder. It only
// counts when it directly qualifies the card itself.
const PREMIUM_PATTERN = new RegExp(`\\bpremium\\s+${CARD_NOUN}`, "i");

const CARD_TIER_PATTERNS: Array<{ tier: CardTier; pattern: RegExp }> = cardTierValues.map((tier) => ({
  tier,
  pattern:
    tier === "premium"
      ? PREMIUM_PATTERN
      : new RegExp(
          `\\b${tier}\\b${tier === "gold" ? GOLD_NON_CARD_SENSE : ""}[^.]{0,${TIER_CARD_CONTEXT_WINDOW}}?${CARD_NOUN}`,
          "i"
        )
}));

export interface CardEligibility {
  cardTypes?: CardKind[];
  cardNetworks?: CardNetwork[];
  cardTiers?: CardTier[];
}

// Which cards an offer names. Keys with no hits are omitted rather than set to an empty array, so
// "we found nothing" never reads as "no cards qualify".
export function parseCardEligibility(text: string): CardEligibility {
  const kinds = CARD_KIND_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ kind }) => kind);
  const networks = CARD_NETWORK_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ network }) => network);
  const tiers = CARD_TIER_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ tier }) => tier);

  return {
    ...(kinds.length > 0 ? { cardTypes: kinds } : {}),
    ...(networks.length > 0 ? { cardNetworks: networks } : {}),
    ...(tiers.length > 0 ? { cardTiers: tiers } : {})
  };
}

// Assigns only when the value resolved, so unparsed fields stay absent from the offer instead of
// becoming explicit undefined keys.
function setWhenParsed<T, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

// Fills the blank enrichment fields on an offer from its own title and description.
export function enrichOffer<T extends ScannedOffer>(offer: T): T {
  const text = `${offer.title} ${offer.description}`;
  const eligibility = parseCardEligibility(text);
  // Fill blanks only: a value already on the offer came from the extractor or a feed mapper, which
  // read structured source data these regexes can only infer from prose.
  const discountPct = offer.discountPct ?? parseDiscountPct(text);

  const enriched: T = { ...offer };
  setWhenParsed(enriched, "discountPct", discountPct);
  setWhenParsed(enriched, "minSpend", offer.minSpend ?? parseMinSpend(text));
  setWhenParsed(enriched, "maxDiscountAmount", offer.maxDiscountAmount ?? parseMaxDiscountAmount(text));
  setWhenParsed(enriched, "validDays", offer.validDays ?? parseValidDays(text));
  setWhenParsed(enriched, "cardTypes", offer.cardTypes ?? eligibility.cardTypes);
  setWhenParsed(enriched, "cardNetworks", offer.cardNetworks ?? eligibility.cardNetworks);
  setWhenParsed(enriched, "cardTiers", offer.cardTiers ?? eligibility.cardTiers);
  setWhenParsed(enriched, "offerType", offer.offerType ?? inferOfferType(text, discountPct));

  return enriched;
}
