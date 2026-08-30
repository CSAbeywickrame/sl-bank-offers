import { describe, expect, it } from "vitest";
import { categorizeOfferText } from "@/lib/ingest/categorize";

describe("categorizeOfferText", () => {
  it("detects dining offers", () => {
    expect(categorizeOfferText("Enjoy dining discounts at restaurants and cafes")).toBe("dining");
  });

  it("separates staying somewhere from getting there", () => {
    expect(categorizeOfferText("Save on hotel stays and resort bookings")).toBe("hotels");
    expect(categorizeOfferText("Earn rewards on airline flights and airport transfers")).toBe("travel");
  });

  // A hotel's restaurant is a meal out, which is what someone browsing Dining wants. Dining is
  // listed before hotels precisely so this copy does not land under Hotels & Resorts.
  it("files a hotel's restaurant under dining", () => {
    expect(categorizeOfferText("20% off the dinner buffet at Cinnamon Grand hotel")).toBe("dining");
  });

  it("detects supermarket and fuel offers", () => {
    expect(categorizeOfferText("Special savings at supermarkets and grocery stores")).toBe("supermarket");
    expect(categorizeOfferText("Fuel discounts at petrol stations and diesel pumps")).toBe("fuel");
  });

  it("detects the verticals added with the new taxonomy", () => {
    expect(categorizeOfferText("15% off at leading jewellery and footwear boutiques")).toBe("fashion");
    expect(categorizeOfferText("Save on laptops, televisions and home appliances")).toBe("electronics");
    expect(categorizeOfferText("Discounts on channelling and laboratory tests at the hospital")).toBe("health");
    expect(categorizeOfferText("Offers on furniture, mattresses and kitchenware")).toBe("home");
    expect(categorizeOfferText("Savings on tyres, batteries and vehicle servicing")).toBe("automotive");
    expect(categorizeOfferText("Cinema tickets and family amusement park entry")).toBe("leisure");
  });

  // Payout mechanics are `offerType` now, parsed in lib/ingest/enrich.ts. The categorizer must
  // answer what is being bought, so an instalment plan still resolves to a real vertical.
  it("never returns a payout mechanic as a category", () => {
    expect(categorizeOfferText("0% interest installment plans on furniture")).toBe("home");
    expect(categorizeOfferText("Cash back on supermarket shopping")).toBe("supermarket");
    expect(categorizeOfferText("Buy one get one free on selected meals")).toBe("dining");
  });

  it("treats online as the fallback it is, not a vertical that outranks the rest", () => {
    expect(categorizeOfferText("Exclusive online app and ecommerce savings")).toBe("online");
    // "Online" describes how you buy; the vertical still wins when the text names one.
    expect(categorizeOfferText("Shop clothing and footwear online")).toBe("fashion");
  });

  it("falls back to other when no category matches", () => {
    expect(categorizeOfferText("Special card benefits for selected purchases")).toBe("other");
  });
});
