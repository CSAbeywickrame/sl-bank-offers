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

const multiOffers: Offer[] = [
  {
    id: "hnb-dining",
    bankId: "hnb",
    bankName: "Hatton National Bank",
    bankShortName: "HNB",
    cardId: "hnb-visa",
    cardName: "Visa",
    title: "HNB dining deal",
    category: "dining",
    description: "20% off at partner restaurants",
    merchant: "Partner restaurants",
    sourceUrl: "https://example.com/hnb",
    firstSeenAt: "2026-06-04T00:00:00.000Z",
    lastSeenAt: "2026-06-04T00:00:00.000Z",
    lastCheckedAt: "2026-06-04T00:00:00.000Z",
    status: "active",
    rawSourceHash: "c"
  },
  {
    id: "ntb-fuel",
    bankId: "ntb",
    bankName: "Nations Trust Bank",
    bankShortName: "NTB",
    cardId: "ntb-mastercard",
    cardName: "Mastercard",
    title: "NTB fuel cashback",
    category: "fuel",
    description: "Save on fuel spends",
    merchant: "Fuel stations",
    sourceUrl: "https://example.com/ntb",
    firstSeenAt: "2026-06-04T00:00:00.000Z",
    lastSeenAt: "2026-06-04T00:00:00.000Z",
    lastCheckedAt: "2026-06-04T00:00:00.000Z",
    status: "active",
    rawSourceHash: "d"
  },
  {
    id: "ndb-travel",
    bankId: "ndb",
    bankName: "National Development Bank",
    bankShortName: "NDB",
    cardId: "ndb-visa",
    cardName: "Visa",
    title: "NDB travel offer",
    category: "travel",
    description: "Discounted hotel bookings",
    merchant: "Partner hotels",
    sourceUrl: "https://example.com/ndb",
    firstSeenAt: "2026-06-04T00:00:00.000Z",
    lastSeenAt: "2026-06-04T00:00:00.000Z",
    lastCheckedAt: "2026-06-04T00:00:00.000Z",
    status: "active",
    rawSourceHash: "e"
  }
];

describe("filterOffers - multi-select", () => {
  it("matches any bank in bankIds (OR)", () => {
    const result = filterOffers(multiOffers, { bankIds: ["hnb", "ndb"] });
    expect(result.map((offer) => offer.id)).toEqual(["hnb-dining", "ndb-travel"]);
  });

  it("matches any category in categories (OR)", () => {
    const result = filterOffers(multiOffers, { categories: ["fuel", "travel"] });
    expect(result.map((offer) => offer.id)).toEqual(["ntb-fuel", "ndb-travel"]);
  });

  it("ANDs bankIds/categories arrays with search", () => {
    const result = filterOffers(multiOffers, { bankIds: ["hnb", "ntb"], search: "cashback" });
    expect(result.map((offer) => offer.id)).toEqual(["ntb-fuel"]);
  });

  it("falls back to single bankId/category when arrays are not provided", () => {
    const result = filterOffers(multiOffers, { bankId: "ndb", category: "travel" });
    expect(result.map((offer) => offer.id)).toEqual(["ndb-travel"]);
  });

  it("prefers bankIds/categories arrays over a single bankId/category when both are given", () => {
    const result = filterOffers(multiOffers, { bankId: "hnb", bankIds: ["ntb", "ndb"] });
    expect(result.map((offer) => offer.id)).toEqual(["ntb-fuel", "ndb-travel"]);
  });
});
