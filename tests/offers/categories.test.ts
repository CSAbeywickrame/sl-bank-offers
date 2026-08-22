import { describe, expect, it } from "vitest";
import { categories, getCategoryLabel, isOfferCategory } from "@/lib/offers/categories";
import { offerCategories, offerTypes } from "@/lib/offers/types";

describe("the offer taxonomy", () => {
  it("accepts every vertical it ships", () => {
    for (const category of offerCategories) {
      expect(isOfferCategory(category)).toBe(true);
    }
  });

  it("rejects a value that is not a category", () => {
    expect(isOfferCategory("groceries")).toBe(false);
    expect(isOfferCategory("")).toBe(false);
  });

  // The split is the point of the taxonomy: a category says what is being bought, an offerType
  // says how it pays out. If a mechanic ever reappears as a category, browsing "hotels" starts
  // returning payment plans again.
  it("keeps payout mechanics out of the categories", () => {
    for (const mechanic of ["installment", "cashback", "bogo"]) {
      expect(isOfferCategory(mechanic)).toBe(false);
      expect(offerTypes).toContain(mechanic);
    }
  });

  it("separates hotels from travel", () => {
    expect(isOfferCategory("hotels")).toBe(true);
    expect(isOfferCategory("travel")).toBe(true);
    expect(getCategoryLabel("hotels")).toBe("Hotels & Resorts");
    expect(getCategoryLabel("travel")).toBe("Travel & Airlines");
  });

  it("gives every category a label and lists them all in the UI", () => {
    expect(categories.map((category) => category.id)).toEqual([...offerCategories]);
    for (const category of categories) {
      expect(category.label.length).toBeGreaterThan(0);
    }
  });
});
