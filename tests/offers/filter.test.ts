import { describe, expect, it } from "vitest";
import { filterOffers } from "@/lib/offers/filter";
import type { Offer } from "@/lib/offers/types";

const offers: Offer[] = [
  {
    id: "1",
    bankId: "hnb",
    bankName: "Hatton National Bank",
    title: "Dining offer",
    category: "dining",
    description: "Discounts for selected restaurants",
    merchant: "Selected restaurants",
    sourceUrl: "https://example.com/hnb",
    firstSeenAt: "2026-06-04T00:00:00.000Z",
    lastSeenAt: "2026-06-04T00:00:00.000Z",
    lastCheckedAt: "2026-06-04T00:00:00.000Z",
    status: "auto_published",
    rawSourceHash: "a"
  },
  {
    id: "2",
    bankId: "dfcc",
    bankName: "DFCC Bank",
    title: "Hotel stay offer",
    category: "hotels",
    description: "Rooms at selected hotels",
    merchant: "Coastal Hotel",
    sourceUrl: "https://example.com/dfcc",
    firstSeenAt: "2026-06-04T00:00:00.000Z",
    lastSeenAt: "2026-06-04T00:00:00.000Z",
    lastCheckedAt: "2026-06-04T00:00:00.000Z",
    status: "auto_published",
    rawSourceHash: "b"
  }
];

describe("filterOffers", () => {
  it("filters by bank and category together", () => {
    const result = filterOffers(offers, { bankId: "hnb", category: "dining" });
    expect(result.map((offer) => offer.id)).toEqual(["1"]);
  });

  it("searches title, bank, merchant, description, and category", () => {
    expect(filterOffers(offers, { search: "coastal" }).map((offer) => offer.id)).toEqual(["2"]);
    expect(filterOffers(offers, { search: "hatton" }).map((offer) => offer.id)).toEqual(["1"]);
    expect(filterOffers(offers, { search: "hotel" }).map((offer) => offer.id)).toEqual(["2"]);
    expect(filterOffers(offers, { search: "dining" }).map((offer) => offer.id)).toEqual(["1"]);
  });

  it("ignores empty filter values", () => {
    expect(filterOffers(offers, { bankId: "", search: " " })).toHaveLength(2);
  });
});
