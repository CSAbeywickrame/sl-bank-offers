import { getCategoryLabel } from "./categories";
import type { Offer, OfferCategory, OfferFilters } from "./types";

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

// Filters offers by bank(s), category(ies), card, and search — array filters OR within a dimension, all dimensions AND together
export function filterOffers(offers: Offer[], filters: OfferFilters): Offer[] {
  const bankIds = filters.bankIds && filters.bankIds.length > 0 ? new Set(filters.bankIds.map(normalize)) : undefined;
  const categories = filters.categories && filters.categories.length > 0 ? new Set(filters.categories) : undefined;
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

    return true;
  });
}
