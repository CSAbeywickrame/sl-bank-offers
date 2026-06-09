import { describe, expect, it } from "vitest";
import { filterOffers } from "@/lib/offers/filter";
import { getActiveOffers, getSeedData } from "@/lib/offers/repository";

describe("seed repository", () => {
  it("loads a curated Sri Lankan bank offer seed with source metadata", async () => {
    const seed = await getSeedData();
    const bankIds = new Set(seed.banks.map((bank) => bank.id));
    const categories = new Set(seed.offers.map((offer) => offer.category));
    const offerBankIds = new Set(
      seed.offers
        .map((offer) => seed.cards.find((card) => card.id === offer.cardId)?.bankId)
        .filter((bankId): bankId is string => Boolean(bankId))
    );

    expect(bankIds).toEqual(new Set(["commercial-bank", "ndb", "boc", "peoples-bank", "ntb"]));
    expect(seed.cards.length).toBeGreaterThanOrEqual(5);
    expect(seed.offers.length).toBeGreaterThanOrEqual(10);
    expect(offerBankIds).toEqual(bankIds);
    expect([...categories]).toEqual(expect.arrayContaining(["dining", "supermarket", "travel", "installment", "online"]));

    for (const offer of seed.offers) {
      expect(offer.status).toBe("active");
      expect(offer.sourceUrl).toMatch(/^https:\/\//);
      expect(offer.termsLink).toMatch(/^https:\/\//);
      expect(offer.lastReviewedAt).toBe("2026-06-09T00:00:00.000Z");
    }
  });

  it("projects seed offers into queryable listing rows", async () => {
    const offers = await getActiveOffers();

    expect(offers.length).toBeGreaterThanOrEqual(10);
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bankId: "commercial-bank",
          bankName: "Commercial Bank of Ceylon"
        }),
        expect.objectContaining({
          bankId: "ndb",
          bankName: "National Development Bank"
        }),
        expect.objectContaining({
          bankId: "boc",
          bankName: "Bank of Ceylon"
        }),
        expect.objectContaining({
          bankId: "peoples-bank",
          bankName: "People's Bank"
        }),
        expect.objectContaining({
          bankId: "ntb",
          bankName: "Nations Trust Bank"
        })
      ])
    );
    expect(filterOffers(offers, { category: "installment" }).length).toBeGreaterThanOrEqual(2);
    expect(filterOffers(offers, { category: "travel" }).length).toBeGreaterThanOrEqual(2);
    expect(filterOffers(offers, { cardId: "ndb-premium-credit-cards" }).map((offer) => offer.id)).toEqual([
      "ndb-education-ipp-june-2026"
    ]);
  });
});
