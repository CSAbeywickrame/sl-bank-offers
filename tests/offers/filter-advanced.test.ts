import { describe, expect, it } from "vitest";
import { filterOffers } from "@/lib/offers/filter";
import { sortOffers } from "@/lib/offers/sort";
import type { Offer } from "@/lib/offers/types";

// Pinned so "ends in 3 days" means the same thing whenever the suite runs.
const NOW = Date.parse("2026-08-31T00:00:00.000Z");
const daysFromNow = (days: number) => new Date(NOW + days * 86_400_000).toISOString().slice(0, 10);

const offer = (overrides: Partial<Offer>): Offer =>
  ({
    id: "id",
    bankId: "hnb",
    bankName: "HNB",
    title: "Offer",
    category: "dining",
    description: "",
    sourceUrl: "https://example.lk",
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-01T00:00:00.000Z",
    lastCheckedAt: "2026-01-01T00:00:00.000Z",
    status: "active",
    rawSourceHash: "hash",
    ...overrides
  }) as Offer;

const ids = (offers: Offer[]) => offers.map((o) => o.id);

describe("minimum discount", () => {
  const offers = [
    offer({ id: "big", discountPct: 30 }),
    offer({ id: "small", discountPct: 10 }),
    offer({ id: "none", offerType: "installment" })
  ];

  it("keeps offers at or above the floor", () => {
    expect(ids(filterOffers(offers, { minDiscountPct: 10 }, NOW))).toEqual(["big", "small"]);
    expect(ids(filterOffers(offers, { minDiscountPct: 30 }, NOW))).toEqual(["big"]);
  });

  // Unlike the card attributes below, this filter is a claim about a number. An offer that states
  // no percentage cannot satisfy "at least 20%", so silence excludes rather than passes.
  it("excludes an offer that states no percentage", () => {
    expect(ids(filterOffers(offers, { minDiscountPct: 10 }, NOW))).not.toContain("none");
  });
});

describe("day of week", () => {
  const offers = [
    offer({ id: "weekend", validDays: ["sat", "sun"] }),
    offer({ id: "weekdays", validDays: ["mon", "tue", "wed", "thu", "fri"] }),
    offer({ id: "anyday" })
  ];

  it("keeps offers valid on the chosen day", () => {
    expect(ids(filterOffers(offers, { day: "sat" }, NOW))).toEqual(["weekend", "anyday"]);
  });

  // An offer with no day restriction runs every day, so it belongs in every day's results. Dropping
  // it would hide most of the catalog behind a filter that looks harmless.
  it("keeps an unrestricted offer on any day", () => {
    expect(ids(filterOffers(offers, { day: "mon" }, NOW))).toContain("anyday");
  });
});

describe("validity window", () => {
  const offers = [
    offer({ id: "ends-tomorrow", validUntil: daysFromNow(1) }),
    offer({ id: "ends-in-5", validUntil: daysFromNow(5) }),
    offer({ id: "ends-in-20", validUntil: daysFromNow(20) }),
    offer({ id: "no-end" }),
    offer({ id: "future", validFrom: daysFromNow(10), validUntil: daysFromNow(40) })
  ];

  it("narrows to offers closing within the horizon", () => {
    expect(ids(filterOffers(offers, { validity: "ends-3d" }, NOW))).toEqual(["ends-tomorrow"]);
    expect(ids(filterOffers(offers, { validity: "ends-week" }, NOW))).toEqual(["ends-tomorrow", "ends-in-5"]);
    expect(ids(filterOffers(offers, { validity: "ends-month" }, NOW))).toEqual([
      "ends-tomorrow",
      "ends-in-5",
      "ends-in-20"
    ]);
  });

  it("finds offers with no stated end date", () => {
    expect(ids(filterOffers(offers, { validity: "no-end" }, NOW))).toEqual(["no-end"]);
  });

  it("finds offers that have not opened yet", () => {
    expect(ids(filterOffers(offers, { validity: "not-started" }, NOW))).toEqual(["future"]);
  });

  // A stale row that already expired must not surface under "ends soon" — that would send someone
  // to a dead offer.
  it("does not surface an already-expired offer as ending soon", () => {
    const stale = [offer({ id: "stale", validUntil: daysFromNow(-2) })];
    expect(filterOffers(stale, { validity: "ends-week" }, NOW)).toEqual([]);
  });
});

describe("date added", () => {
  const offers = [
    offer({ id: "fresh", firstSeenAt: new Date(NOW - 2 * 86_400_000).toISOString() }),
    offer({ id: "recent", firstSeenAt: new Date(NOW - 20 * 86_400_000).toISOString() }),
    offer({ id: "old", firstSeenAt: new Date(NOW - 90 * 86_400_000).toISOString() })
  ];

  it("narrows to offers added inside the window", () => {
    expect(ids(filterOffers(offers, { added: "7d" }, NOW))).toEqual(["fresh"]);
    expect(ids(filterOffers(offers, { added: "30d" }, NOW))).toEqual(["fresh", "recent"]);
  });
});

describe("card eligibility", () => {
  const offers = [
    offer({ id: "visa", cardNetworks: ["visa"] }),
    offer({ id: "mc", cardNetworks: ["mastercard"] }),
    offer({ id: "unstated" }),
    offer({ id: "credit", cardTypes: ["credit"] }),
    offer({ id: "infinite", cardTiers: ["infinite"] })
  ];

  it("keeps offers naming the chosen network", () => {
    expect(ids(filterOffers(offers, { cardNetworks: ["visa"] }, NOW))).toContain("visa");
    expect(ids(filterOffers(offers, { cardNetworks: ["visa"] }, NOW))).not.toContain("mc");
  });

  /**
   * An offer that names no network is not a Visa-only offer — it is an offer whose terms did not
   * say, and most of those are open to every card. Excluding it would tell a Visa holder that
   * nothing applies to them when plenty does.
   */
  it("keeps an offer that states no eligibility at all", () => {
    expect(ids(filterOffers(offers, { cardNetworks: ["visa"] }, NOW))).toContain("unstated");
    expect(ids(filterOffers(offers, { cardTypes: ["debit"] }, NOW))).toContain("unstated");
    expect(ids(filterOffers(offers, { cardTiers: ["gold"] }, NOW))).toContain("unstated");
  });

  it("ORs within a dimension", () => {
    const kept = ids(filterOffers(offers, { cardNetworks: ["visa", "mastercard"] }, NOW));
    expect(kept).toContain("visa");
    expect(kept).toContain("mc");
  });
});

describe("offer type", () => {
  const offers = [
    offer({ id: "disc", offerType: "discount" }),
    offer({ id: "inst", offerType: "installment" }),
    offer({ id: "untyped" })
  ];

  // Unlike eligibility, offerType is set on every offer the pipeline writes, so an absent value is
  // a pre-enrichment row rather than "applies to all" — it should not answer a specific request.
  it("keeps only offers of the chosen type", () => {
    expect(ids(filterOffers(offers, { offerTypes: ["installment"] }, NOW))).toEqual(["inst"]);
  });
});

describe("dimensions combine", () => {
  it("ANDs across dimensions while ORing within one", () => {
    const offers = [
      offer({ id: "match", discountPct: 25, cardNetworks: ["visa"], validDays: ["sat"] }),
      offer({ id: "wrong-day", discountPct: 25, cardNetworks: ["visa"], validDays: ["mon"] }),
      offer({ id: "too-small", discountPct: 5, cardNetworks: ["visa"], validDays: ["sat"] })
    ];
    const kept = filterOffers(offers, { minDiscountPct: 20, cardNetworks: ["visa"], day: "sat" }, NOW);
    expect(ids(kept)).toEqual(["match"]);
  });
});

describe("biggest-discount sort", () => {
  it("orders by advertised discount, largest first", () => {
    const offers = [
      offer({ id: "small", discountPct: 10 }),
      offer({ id: "big", discountPct: 50 }),
      offer({ id: "mid", discountPct: 25 })
    ];
    expect(ids(sortOffers(offers, "biggest-discount"))).toEqual(["big", "mid", "small"]);
  });

  // An instalment plan has no percentage to rank by. Treating it as 0% would bury genuine offers
  // beneath it, so unrated offers keep their order at the end instead.
  it("puts offers with no stated discount last, in their original order", () => {
    const offers = [
      offer({ id: "none-a", offerType: "installment" }),
      offer({ id: "big", discountPct: 50 }),
      offer({ id: "none-b", offerType: "cashback" })
    ];
    expect(ids(sortOffers(offers, "biggest-discount"))).toEqual(["big", "none-a", "none-b"]);
  });

  it("does not mutate the array it was given", () => {
    const offers = [offer({ id: "a", discountPct: 10 }), offer({ id: "b", discountPct: 40 })];
    sortOffers(offers, "biggest-discount");
    expect(ids(offers)).toEqual(["a", "b"]);
  });
});
