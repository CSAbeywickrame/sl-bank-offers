import { describe, expect, it } from "vitest";
import { categories, isBrowsableCategory, isOfferCategory } from "@/lib/offers/categories";
import { activeOfferCategories } from "@/lib/offers/types";

describe("category guards during the taxonomy migration", () => {
  it("accepts a migration vertical as a valid schema value", () => {
    expect(isOfferCategory("hotels")).toBe(true);
    expect(isOfferCategory("electronics")).toBe(true);
  });

  // The category route uses this as its 404 guard. Answering 200 with canonical and OpenGraph
  // metadata for a vertical that holds no offers invites those pages into the index, and leaving
  // them out of the sitemap does not keep them out.
  it("does not treat a migration vertical as browsable", () => {
    expect(isBrowsableCategory("hotels")).toBe(false);
    expect(isBrowsableCategory("electronics")).toBe(false);
  });

  it("treats every category in use today as both valid and browsable", () => {
    for (const category of activeOfferCategories) {
      expect(isOfferCategory(category)).toBe(true);
      expect(isBrowsableCategory(category)).toBe(true);
    }
  });

  it("rejects a value that is not a category at all", () => {
    expect(isOfferCategory("groceries")).toBe(false);
    expect(isBrowsableCategory("groceries")).toBe(false);
  });

  it("lists exactly the browsable categories in the UI", () => {
    expect(categories.map((category) => category.id)).toEqual([...activeOfferCategories]);
  });
});
