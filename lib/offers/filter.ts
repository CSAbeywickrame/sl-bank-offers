import { getCategoryLabel } from "./categories";
import type { Offer, OfferFilters } from "./types";

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

export function filterOffers(offers: Offer[], filters: OfferFilters): Offer[] {
  const bankId = normalize(filters.bankId);
  const cardId = normalize(filters.cardId);
  const search = normalize(filters.search);
  const category = filters.category;

  return offers.filter((offer) => {
    if (bankId && offer.bankId !== bankId) {
      return false;
    }

    if (cardId && offer.cardId !== cardId) {
      return false;
    }

    if (category && offer.category !== category) {
      return false;
    }

    if (search && !searchableText(offer).includes(search)) {
      return false;
    }

    return true;
  });
}
