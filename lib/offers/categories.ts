import { offerCategories, type OfferCategory } from "./types";

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
