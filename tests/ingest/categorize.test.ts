import { describe, expect, it } from "vitest";
import { categorizeOfferText } from "@/lib/ingest/categorize";

describe("categorizeOfferText", () => {
  it("detects dining offers", () => {
    expect(categorizeOfferText("Enjoy dining discounts at restaurants and cafes")).toBe("dining");
  });

  it("detects hotel offers", () => {
    expect(categorizeOfferText("Save on hotel stays and resort bookings")).toBe("hotels");
  });

  it("detects travel offers", () => {
    expect(categorizeOfferText("Earn rewards on airline flights and airport transfers")).toBe("travel");
  });

  it("detects supermarket and fuel offers", () => {
    expect(categorizeOfferText("Special savings at supermarkets and grocery stores")).toBe("supermarkets");
    expect(categorizeOfferText("Fuel discounts at petrol stations and diesel pumps")).toBe("fuel");
  });

  it("detects health and entertainment offers", () => {
    expect(categorizeOfferText("Save on pharmacy purchases and clinic visits")).toBe("health");
    expect(categorizeOfferText("Movie tickets, concerts, and cinema nights")).toBe("entertainment");
  });

  it("falls back to other when no category matches", () => {
    expect(categorizeOfferText("Special card benefits for selected purchases")).toBe("other");
  });
});
