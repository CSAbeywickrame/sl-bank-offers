import { getCategoryLabel } from "./categories";
import type {
  AddedWindow,
  Offer,
  OfferCategory,
  OfferFilters,
  ValidityWindow,
  Weekday
} from "./types";

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function searchableText(offer: Offer): string {
  return [
    offer.title,
    offer.bankName,
    offer.bankShortName,
    offer.cardName,
    offer.merchant,
    offer.description,
    offer.category,
    getCategoryLabel(offer.category)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// Checks the bank dimension: matches when bankIds is set (OR across the set), falling back to the single bankId when bankIds is absent
function matchesBank(offer: Offer, bankIds: Set<string> | undefined, bankId: string): boolean {
  if (bankIds) {
    return bankIds.has(offer.bankId);
  }

  return !bankId || offer.bankId === bankId;
}

// Checks the category dimension: matches when categories is set (OR across the set), falling back to the single category when categories is absent
function matchesCategory(offer: Offer, categories: Set<OfferCategory> | undefined, category: OfferCategory | undefined): boolean {
  if (categories) {
    return categories.has(offer.category);
  }

  return !category || offer.category === category;
}

/**
 * A card attribute an offer only sometimes states.
 *
 * An offer that names no network is not a Visa-only offer — it is an offer whose terms did not say,
 * and most of those are open to every card. Excluding it from a Visa filter would hide a perfectly
 * usable offer, so silence passes. The cost is a few false positives; the alternative is telling a
 * cardholder that nothing applies to them when plenty does.
 */
function matchesCardAttribute<T extends string>(offerValues: T[] | undefined, wanted: Set<T> | undefined): boolean {
  if (!wanted) return true;
  if (!offerValues || offerValues.length === 0) return true;
  return offerValues.some((value) => wanted.has(value));
}

/** Same rule for days: an offer with no day restriction runs every day, so it matches any of them. */
function matchesDay(offer: Offer, day: Weekday | undefined): boolean {
  if (!day) return true;
  if (!offer.validDays || offer.validDays.length === 0) return true;
  return offer.validDays.includes(day);
}

// Days are compared as whole days from `now`, so "ends in 3 days" means the same thing at 9am and
// at 11pm rather than shifting with the hour someone happens to browse.
function daysUntil(value: string | undefined, now: number): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return Math.ceil((timestamp - now) / 86_400_000);
}

const VALIDITY_HORIZONS: Partial<Record<ValidityWindow, number>> = {
  "ends-3d": 3,
  "ends-week": 7,
  "ends-month": 30
};

function matchesValidity(offer: Offer, validity: ValidityWindow | undefined, now: number): boolean {
  if (!validity) return true;

  if (validity === "no-end") {
    // No stated end date — an offer that runs until the bank says otherwise.
    return !offer.validUntil;
  }

  if (validity === "not-started") {
    const startsIn = daysUntil(offer.validFrom, now);
    return startsIn !== undefined && startsIn > 0;
  }

  const horizon = VALIDITY_HORIZONS[validity];
  if (horizon === undefined) return true;
  const endsIn = daysUntil(offer.validUntil, now);
  // Already-expired offers are filtered out upstream; a negative value here means the row is stale,
  // and surfacing it under "ends soon" would send someone to a dead offer.
  return endsIn !== undefined && endsIn >= 0 && endsIn <= horizon;
}

const ADDED_HORIZONS: Record<AddedWindow, number> = { "7d": 7, "30d": 30 };

function matchesAdded(offer: Offer, added: AddedWindow | undefined, now: number): boolean {
  if (!added) return true;
  const firstSeen = Date.parse(offer.firstSeenAt);
  if (Number.isNaN(firstSeen)) return false;
  return now - firstSeen <= ADDED_HORIZONS[added] * 86_400_000;
}

function toSet<T>(values: T[] | undefined): Set<T> | undefined {
  return values && values.length > 0 ? new Set(values) : undefined;
}

/**
 * Filters offers. Values OR within a dimension, dimensions AND together.
 *
 * `now` is injected so a test can pin the date rather than depending on when it runs.
 */
export function filterOffers(offers: Offer[], filters: OfferFilters, now: number = Date.now()): Offer[] {
  const bankIds = filters.bankIds && filters.bankIds.length > 0 ? new Set(filters.bankIds.map(normalize)) : undefined;
  const categories = toSet(filters.categories);
  const offerTypes = toSet(filters.offerTypes);
  const networks = toSet(filters.cardNetworks);
  const cardTypes = toSet(filters.cardTypes);
  const cardTiers = toSet(filters.cardTiers);
  const bankId = normalize(filters.bankId);
  const cardId = normalize(filters.cardId);
  const search = normalize(filters.search);

  return offers.filter((offer) => {
    if (!matchesBank(offer, bankIds, bankId)) {
      return false;
    }

    if (!matchesCategory(offer, categories, filters.category)) {
      return false;
    }

    if (cardId && offer.cardId !== cardId) {
      return false;
    }

    if (search && !searchableText(offer).includes(search)) {
      return false;
    }

    if (offerTypes && !(offer.offerType && offerTypes.has(offer.offerType))) {
      return false;
    }

    // A minimum discount is a claim about the number, so an offer with no stated percentage cannot
    // satisfy it — unlike the card attributes above, where silence means "unrestricted".
    if (filters.minDiscountPct !== undefined) {
      if (offer.discountPct === undefined || offer.discountPct < filters.minDiscountPct) {
        return false;
      }
    }

    if (!matchesDay(offer, filters.day)) {
      return false;
    }

    if (!matchesValidity(offer, filters.validity, now)) {
      return false;
    }

    if (!matchesAdded(offer, filters.added, now)) {
      return false;
    }

    if (!matchesCardAttribute(offer.cardNetworks, networks)) {
      return false;
    }

    if (!matchesCardAttribute(offer.cardTypes, cardTypes)) {
      return false;
    }

    if (!matchesCardAttribute(offer.cardTiers, cardTiers)) {
      return false;
    }

    return true;
  });
}
