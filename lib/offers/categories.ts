import type { OfferCategory } from "./types";

export interface CategoryMeta {
  id: OfferCategory;
  label: string;
}

export const categories: CategoryMeta[] = [
  { id: "dining", label: "Dining" },
  { id: "travel", label: "Travel" },
  { id: "hotels", label: "Hotels" },
  { id: "shopping", label: "Shopping" },
  { id: "supermarkets", label: "Supermarkets" },
  { id: "fuel", label: "Fuel" },
  { id: "health", label: "Health" },
  { id: "education", label: "Education" },
  { id: "online", label: "Online" },
  { id: "entertainment", label: "Entertainment" },
  { id: "other", label: "Other" }
];

export function getCategoryLabel(category: OfferCategory): string {
  return categories.find((item) => item.id === category)?.label ?? "Other";
}

export function isOfferCategory(value: string): value is OfferCategory {
  return categories.some((category) => category.id === value);
}
