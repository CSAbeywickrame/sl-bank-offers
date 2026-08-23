import { offerCategories, type OfferCategory } from "./types";

export interface CategoryMeta {
  id: OfferCategory;
  label: string;
}

// Labels name the vertical the way a shopper would say it, which is not always the way the id
// reads: "Travel" alone was ambiguous once hotels moved out of it, so it says what is left.
const categoryLabels: Record<OfferCategory, string> = {
  hotels: "Hotels & Resorts",
  dining: "Dining",
  home: "Home & Living",
  travel: "Travel & Airlines",
  health: "Health & Wellness",
  fashion: "Fashion & Retail",
  electronics: "Electronics",
  automotive: "Automotive",
  supermarket: "Supermarkets",
  leisure: "Leisure & Entertainment",
  online: "Online",
  fuel: "Fuel",
  other: "Other"
};

export const categories: CategoryMeta[] = offerCategories.map((category) => ({
  id: category,
  label: categoryLabels[category]
}));

export function getCategoryLabel(category: OfferCategory): string {
  return categoryLabels[category] ?? "Other";
}

export function isOfferCategory(value: string): value is OfferCategory {
  return offerCategories.includes(value as OfferCategory);
}
