import { describe, expect, it } from "vitest";
import { filterOffers } from "@/lib/offers/filter";
import type { Offer } from "@/lib/offers/types";

const offers: Offer[] = [
  {
    id: "1",
    bankId: "hnb",
    bankName: "Hatton National Bank",
    bankShortName: "HNB",
    cardId: "hnb-visa-signature",
    cardName: "Visa Signature Credit Card",
    title: "Dining offer",
    category: "dining",
    description: "Discounts for selected restaurants",
    merchant: "Selected restaurants",
    sourceUrl: "https://example.com/hnb",
    firstSeenAt: "2026-06-04T00:00:00.000Z",
    lastSeenAt: "2026-06-04T00:00:00.000Z",
    lastCheckedAt: "2026-06-04T00:00:00.000Z",
    status: "active",
    rawSourceHash: "a"
  },
  {
    id: "2",
    bankId: "hnb",
    bankName: "Hatton National Bank",
    bankShortName: "HNB",
    cardId: "hnb-mastercard-platinum",
    cardName: "Mastercard Platinum Credit Card",
    title: "Weekend fuel cashback",
    category: "fuel",
    description: "Cashback on weekend fuel spends",
    merchant: "Selected fuel stations",
    sourceUrl: "https://example.com/dfcc",
    firstSeenAt: "2026-06-04T00:00:00.000Z",
    lastSeenAt: "2026-06-04T00:00:00.000Z",
    lastCheckedAt: "2026-06-04T00:00:00.000Z",
    status: "active",
    rawSourceHash: "b"
  }
];

describe("filterOffers", () => {
  it("filters by bank and category together", () => {
    const result = filterOffers(offers, { bankId: "hnb", category: "dining" });
    expect(result.map((offer) => offer.id)).toEqual(["1"]);
  });

  it("filters by card", () => {
    const result = filterOffers(offers, { cardId: "hnb-mastercard-platinum" });
    expect(result.map((offer) => offer.id)).toEqual(["2"]);
  });

  it("searches title, bank, merchant, description, and category", () => {
    expect(filterOffers(offers, { search: "credit card" }).map((offer) => offer.id)).toEqual(["1", "2"]);
    expect(filterOffers(offers, { search: "hatton" }).map((offer) => offer.id)).toEqual(["1", "2"]);
    expect(filterOffers(offers, { search: "cashback" }).map((offer) => offer.id)).toEqual(["2"]);
    expect(filterOffers(offers, { search: "dining" }).map((offer) => offer.id)).toEqual(["1"]);
  });

  it("ignores empty filter values", () => {
    expect(filterOffers(offers, { bankId: "", search: " " })).toHaveLength(2);
  });
});
