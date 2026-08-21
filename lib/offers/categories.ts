import { activeOfferCategories, offerCategories, type OfferCategory } from "./types";

export interface CategoryMeta {
  id: OfferCategory;
  label: string;
}

const categoryLabels: Record<OfferCategory, string> = {
  dining: "Dining",
  fuel: "Fuel",
  supermarket: "Supermarket",
  travel: "Travel",
  online: "Online",
  installment: "Installment",
  cashback: "Cashback",
  bogo: "BOGO",
  other: "Other",
  hotels: "Hotels",
  fashion: "Fashion",
  electronics: "Electronics",
  health: "Health",
  home: "Home",
  automotive: "Automotive",
  leisure: "Leisure"
};

// Only the categories in use today are listed for the UI. The migration verticals are valid schema
// values, but no offer carries one yet, so surfacing them would add filter pills and index cards
// that always come back empty. This list grows when the offer data migrates onto them.
export const categories: CategoryMeta[] = activeOfferCategories.map((category) => ({
  id: category,
  label: categoryLabels[category]
}));

export function getCategoryLabel(category: OfferCategory): string {
  return categoryLabels[category] ?? "Other";
}

// Schema-level validity: accepts the migration verticals too, so stored data and saved filter
// presets stay readable while the taxonomy moves.
export function isOfferCategory(value: string): value is OfferCategory {
  return offerCategories.includes(value as OfferCategory);
}

// Whether a category has a page worth serving. Distinct from `isOfferCategory` on purpose: routing
// off the schema superset would answer 200 with canonical and OpenGraph metadata for seven
// categories that hold no offers, and keeping them out of the sitemap does not keep them out of
// the index. They become browsable in the same change that migrates the data onto them.
export function isBrowsableCategory(value: string): value is OfferCategory {
  // Widened before the lookup: `activeOfferCategories` is a narrower const tuple than OfferCategory,
  // so its own `includes` would reject the migration verticals at compile time — which is the very
  // question being asked here.
  return (activeOfferCategories as readonly string[]).includes(value);
}
