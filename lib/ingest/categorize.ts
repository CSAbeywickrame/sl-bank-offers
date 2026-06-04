import type { OfferCategory } from "@/lib/offers/types";

const DINING_RE = /\b(dining|restaurant|restaurants|cafe|cafes|eatery|food)\b/i;
const HOTELS_RE = /\b(hotel|hotels|resort|resorts|stay|stays|accommodation)\b/i;

export function categorizeOfferText(text: string): OfferCategory {
  if (DINING_RE.test(text)) return "dining";
  if (HOTELS_RE.test(text)) return "hotels";
  return "other";
}
