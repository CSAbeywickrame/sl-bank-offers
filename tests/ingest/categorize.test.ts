import { describe, expect, it } from "vitest";
import { categorizeOfferText } from "@/lib/ingest/categorize";

describe("categorizeOfferText", () => {
  it("detects dining offers", () => {
    expect(categorizeOfferText("Enjoy dining discounts at restaurants and cafes")).toBe("dining");
  });

  it("detects travel offers from hotel copy", () => {
    expect(categorizeOfferText("Save on hotel stays and resort bookings")).toBe("travel");
  });

  it("detects travel offers", () => {
    expect(categorizeOfferText("Earn rewards on airline flights and airport transfers")).toBe("travel");
  });

  it("detects supermarket and fuel offers", () => {
    expect(categorizeOfferText("Special savings at supermarkets and grocery stores")).toBe("supermarket");
    expect(categorizeOfferText("Fuel discounts at petrol stations and diesel pumps")).toBe("fuel");
  });

  it("detects installment, cashback, bogo, and online offers", () => {
    expect(categorizeOfferText("0% interest installment plans for large purchases")).toBe("installment");
    expect(categorizeOfferText("Cash back on utility bill payments")).toBe("cashback");
    expect(categorizeOfferText("Buy one get one free on selected meals")).toBe("bogo");
    expect(categorizeOfferText("Exclusive online app and ecommerce savings")).toBe("online");
  });

  it("falls back to other when no category matches", () => {
    expect(categorizeOfferText("Special card benefits for selected purchases")).toBe("other");
  });
});
