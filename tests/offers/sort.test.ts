import { describe, expect, it } from "vitest";
import { sortOffers } from "@/lib/offers/sort";
import type { Offer } from "@/lib/offers/types";

// Builds a minimal valid Offer for sort tests, with overrides for the fields under test
function makeOffer(id: string, overrides: Partial<Offer> = {}): Offer {
  return {
    id,
    bankId: "hnb",
    bankName: "Hatton National Bank",
    title: `Offer ${id}`,
    category: "dining",
    description: "desc",
    sourceUrl: "https://example.com",
    firstSeenAt: "2026-06-01T00:00:00.000Z",
    lastSeenAt: "2026-06-01T00:00:00.000Z",
    lastCheckedAt: "2026-06-01T00:00:00.000Z",
    status: "active",
    rawSourceHash: id,
    ...overrides,
  };
}

describe("sortOffers", () => {
  it("returns a copy of the input, unchanged in order, for relevance", () => {
    const offers = [makeOffer("1"), makeOffer("2")];
    const result = sortOffers(offers, "relevance");
    expect(result.map((o) => o.id)).toEqual(["1", "2"]);
    expect(result).not.toBe(offers);
  });

  it("sorts by lastSeenAt descending for newest", () => {
    const offers = [
      makeOffer("1", { lastSeenAt: "2026-06-01T00:00:00.000Z" }),
      makeOffer("2", { lastSeenAt: "2026-06-03T00:00:00.000Z" }),
      makeOffer("3", { lastSeenAt: "2026-06-02T00:00:00.000Z" }),
    ];
    expect(sortOffers(offers, "newest").map((o) => o.id)).toEqual(["2", "3", "1"]);
  });

  it("tie-breaks newest by firstSeenAt descending when lastSeenAt matches", () => {
    const offers = [
      makeOffer("1", { lastSeenAt: "2026-06-01T00:00:00.000Z", firstSeenAt: "2026-05-01T00:00:00.000Z" }),
      makeOffer("2", { lastSeenAt: "2026-06-01T00:00:00.000Z", firstSeenAt: "2026-05-10T00:00:00.000Z" }),
    ];
    expect(sortOffers(offers, "newest").map((o) => o.id)).toEqual(["2", "1"]);
  });

  it("sorts offers with validUntil ascending for expiring-soon", () => {
    const offers = [
      makeOffer("1", { validUntil: "2026-07-20T00:00:00.000Z" }),
      makeOffer("2", { validUntil: "2026-07-10T00:00:00.000Z" }),
      makeOffer("3", { validUntil: "2026-07-15T00:00:00.000Z" }),
    ];
    expect(sortOffers(offers, "expiring-soon").map((o) => o.id)).toEqual(["2", "3", "1"]);
  });

  it("places offers without a parseable validUntil last, preserving their relative order", () => {
    const offers = [
      makeOffer("1", { validUntil: undefined }),
      makeOffer("2", { validUntil: "2026-07-10T00:00:00.000Z" }),
      makeOffer("3", { validUntil: "not-a-date" }),
      makeOffer("4", { validUntil: "2026-07-05T00:00:00.000Z" }),
    ];
    expect(sortOffers(offers, "expiring-soon").map((o) => o.id)).toEqual(["4", "2", "1", "3"]);
  });

  it("does not mutate the input array", () => {
    const offers = [
      makeOffer("1", { lastSeenAt: "2026-06-01T00:00:00.000Z" }),
      makeOffer("2", { lastSeenAt: "2026-06-03T00:00:00.000Z" }),
    ];
    const original = [...offers];
    sortOffers(offers, "newest");
    expect(offers).toEqual(original);
  });
});
