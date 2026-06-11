import { describe, expect, it } from "vitest";
import { getSeedData } from "@/lib/offers/repository";
import { loadScannedOfferCatalog, syncScannedOffers } from "@/lib/offers/scanned";
import type { SeedData } from "@/lib/offers/types";

describe("scanned offer catalog", () => {
  it("loads the tracked scanned-offer handoff catalog and keeps it synced into the app seed", async () => {
    const scanned = loadScannedOfferCatalog();
    const seed = await getSeedData();
    const seedOffersById = new Map(seed.offers.map((offer) => [offer.id, offer]));

    expect(scanned.version).toBe(1);
    expect(scanned.offers).toHaveLength(368);
    expect(scanned.offers.filter((offer) => offer.bankId === "ntb")).toHaveLength(143);
    expect(scanned.offers.filter((offer) => offer.bankId === "peoples-bank")).toHaveLength(190);
    expect(scanned.offers.filter((offer) => offer.bankId === "pan-asia-bank")).toHaveLength(6);

    for (const scannedOffer of scanned.offers) {
      const seedOffer = seedOffersById.get(scannedOffer.id);

      expect(seedOffer).toBeDefined();
      expect(seedOffer).toEqual(expect.objectContaining({
        cardId: scannedOffer.cardId,
        category: scannedOffer.category,
        title: scannedOffer.title,
        sourceUrl: scannedOffer.sourceUrl,
        termsLink: scannedOffer.termsLink
      }));
    }
  });

  it("upserts scanned offers without dropping unrelated seed records", () => {
    const seed: SeedData = {
      banks: [
        {
          id: "commercial-bank",
          name: "Commercial Bank of Ceylon",
          shortName: "Commercial Bank",
          websiteUrl: "https://www.combank.lk"
        },
        {
          id: "ndb",
          name: "National Development Bank",
          shortName: "NDB",
          websiteUrl: "https://www.ndbbank.com"
        }
      ],
      cards: [
        {
          id: "commercial-bank-credit-cards",
          bankId: "commercial-bank",
          name: "Commercial Bank Credit Cards"
        },
        {
          id: "ndb-credit-cards",
          bankId: "ndb",
          name: "NDB Credit Cards"
        }
      ],
      offers: [
        {
          id: "commercial-bank-blue-orbit-citrus-june-2026",
          cardId: "commercial-bank-credit-cards",
          title: "Old Blue Orbit title",
          category: "dining",
          description: "Old description",
          termsLink: "https://example.com/old-blue-orbit",
          sourceUrl: "https://example.com/old-blue-orbit",
          lastReviewedAt: "2026-06-01T00:00:00.000Z",
          status: "needs_review"
        },
        {
          id: "ndb-findmyfare-june-2026",
          cardId: "ndb-credit-cards",
          title: "NDB travel offer",
          category: "travel",
          description: "Unrelated record",
          termsLink: "https://example.com/ndb",
          sourceUrl: "https://example.com/ndb",
          lastReviewedAt: "2026-06-09T00:00:00.000Z",
          status: "active"
        }
      ]
    };

    const nextSeed = syncScannedOffers(seed, {
      version: 1,
      updatedAt: "2026-06-10T00:00:00.000Z",
      offers: [
        {
          id: "commercial-bank-blue-orbit-citrus-june-2026",
          bankId: "commercial-bank",
          cardId: "commercial-bank-credit-cards",
          title: "15% off at Blue Orbit by Citrus",
          category: "dining",
          description: "Updated description",
          merchant: "Blue Orbit by Citrus",
          location: "Sri Lanka",
          validUntil: "2026-06-30",
          termsLink:
            "https://www.combank.lk/rewards-promotion/food-restaurants/enjoy-the-art-of-dining-at-blue-orbit-by-citrus-with-combank-credit-cards",
          sourceUrl:
            "https://www.combank.lk/rewards-promotion/food-restaurants/enjoy-the-art-of-dining-at-blue-orbit-by-citrus-with-combank-credit-cards",
          lastReviewedAt: "2026-06-10T00:00:00.000Z",
          status: "active"
        }
      ]
    });

    expect(nextSeed.offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "commercial-bank-blue-orbit-citrus-june-2026",
          title: "15% off at Blue Orbit by Citrus",
          description: "Updated description",
          status: "active"
        }),
        expect.objectContaining({
          id: "ndb-findmyfare-june-2026",
          title: "NDB travel offer"
        })
      ])
    );
    expect(nextSeed.offers).toHaveLength(2);
  });

  it("replaces a legacy seed offer when scanned rows point at the same page via hash-fragment URLs", () => {
    const seed: SeedData = {
      banks: [
        {
          id: "peoples-bank",
          name: "People's Bank",
          shortName: "People's Bank",
          websiteUrl: "https://www.peoplesbank.lk"
        }
      ],
      cards: [
        {
          id: "peoples-bank-credit-cards",
          bankId: "peoples-bank",
          name: "People's Bank Credit Cards"
        }
      ],
      offers: [
        {
          id: "peoples-bank-installments-december-2026",
          cardId: "peoples-bank-credit-cards",
          title: "No-fee installment plans up to 36 months",
          category: "installment",
          description: "Legacy aggregate installment record",
          termsLink: "https://www.peoplesbank.lk/installments/?cardType=credit_card",
          sourceUrl: "https://www.peoplesbank.lk/installments/?cardType=credit_card",
          lastReviewedAt: "2026-06-09T00:00:00.000Z",
          status: "active"
        }
      ]
    };

    const nextSeed = syncScannedOffers(seed, {
      version: 1,
      updatedAt: "2026-06-10T00:00:00.000Z",
      offers: [
        {
          id: "peoples-bank-travel-installments-june-2026",
          bankId: "peoples-bank",
          cardId: "peoples-bank-credit-cards",
          title: "Travel installment plans",
          category: "installment",
          description: "Travel installment plan",
          merchant: "Travel",
          validUntil: "2026-06-30",
          termsLink: "https://www.peoplesbank.lk/installments/?cardType=credit_card#travel",
          sourceUrl: "https://www.peoplesbank.lk/installments/?cardType=credit_card#travel",
          lastReviewedAt: "2026-06-10T00:00:00.000Z",
          status: "active"
        }
      ]
    });

    expect(nextSeed.offers).toEqual([
      expect.objectContaining({
        id: "peoples-bank-travel-installments-june-2026",
        sourceUrl: "https://www.peoplesbank.lk/installments/?cardType=credit_card#travel"
      })
    ]);
  });
});
