import { describe, expect, it } from "vitest";
import { importBankOffers } from "@/lib/ingest/importBank";
import type { ScannedOffer, ScannedOfferCatalog, SeedData } from "@/lib/offers/types";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";

const REVIEW_DATE = "2026-08-21T00:00:00.000Z";

const entry: BankRegistryEntry = {
  bankId: "test-bank",
  enabled: true,
  bank: { id: "test-bank", name: "Test Bank", shortName: "Test Bank", websiteUrl: "https://example.com" },
  cards: [{ id: "test-bank-credit-cards", bankId: "test-bank", name: "Test Bank Credit Cards" }],
  defaultCardId: "test-bank-credit-cards",
  sources: [{ url: "https://example.com/offers", type: "static_html" }]
};

const scannedOffer = (overrides: Partial<ScannedOffer> = {}): ScannedOffer => ({
  id: "test-bank-blue-orbit",
  bankId: "test-bank",
  cardId: "test-bank-credit-cards",
  title: "25% off at Blue Orbit",
  category: "dining",
  description: "Enjoy 25% off for Visa credit cardholders on Fridays.",
  termsLink: "https://example.com/offers/blue-orbit",
  sourceUrl: "https://example.com/offers/blue-orbit",
  lastReviewedAt: REVIEW_DATE,
  status: "active",
  ...overrides
});

const emptySeed: SeedData = { banks: [], cards: [], offers: [] };

const catalogWith = (offers: ScannedOffer[]): ScannedOfferCatalog => ({
  version: 1,
  updatedAt: "2026-08-14T00:00:00.000Z",
  offers
});

// Reads an imported offer back out of the returned catalog.
const importedOffer = (catalog: ScannedOfferCatalog, id: string): ScannedOffer => {
  const offer = catalog.offers.find((o) => o.id === id);
  if (!offer) throw new Error(`Expected imported offer ${id}`);
  return offer;
};

describe("importBankOffers firstSeenAt carry-over", () => {
  it("keeps the firstSeenAt of the row it replaces", () => {
    const prior = catalogWith([scannedOffer({ firstSeenAt: "2026-01-01T00:00:00.000Z", lastReviewedAt: "2026-08-14T00:00:00.000Z" })]);

    const { catalog } = importBankOffers(entry, [scannedOffer()], REVIEW_DATE, emptySeed, prior);

    expect(importedOffer(catalog, "test-bank-blue-orbit").firstSeenAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("falls back to the replaced row's review date for rows imported before firstSeenAt existed", () => {
    const prior = catalogWith([scannedOffer({ lastReviewedAt: "2026-03-05T00:00:00.000Z" })]);

    const { catalog } = importBankOffers(entry, [scannedOffer()], REVIEW_DATE, emptySeed, prior);

    expect(importedOffer(catalog, "test-bank-blue-orbit").firstSeenAt).toBe("2026-03-05T00:00:00.000Z");
  });

  it("stamps a brand-new offer with the review date", () => {
    const { catalog } = importBankOffers(entry, [scannedOffer({ id: "test-bank-new-offer" })], REVIEW_DATE, emptySeed, catalogWith([]));

    expect(importedOffer(catalog, "test-bank-new-offer").firstSeenAt).toBe(REVIEW_DATE);
  });

  it("lets an incoming explicit firstSeenAt win over the prior row", () => {
    const prior = catalogWith([scannedOffer({ firstSeenAt: "2026-01-01T00:00:00.000Z" })]);
    const incoming = scannedOffer({ firstSeenAt: "2025-12-25T00:00:00.000Z" });

    const { catalog } = importBankOffers(entry, [incoming], REVIEW_DATE, emptySeed, prior);

    expect(importedOffer(catalog, "test-bank-blue-orbit").firstSeenAt).toBe("2025-12-25T00:00:00.000Z");
  });

  it("does not borrow firstSeenAt from another bank's row with the same id", () => {
    // The other bank has to exist in the seed: its catalog row survives this import, and
    // syncScannedOffers rejects a catalog row whose bank/card is missing from the seed.
    const seed: SeedData = {
      banks: [{ id: "other-bank", name: "Other Bank", shortName: "Other Bank", websiteUrl: "https://other.example.com" }],
      cards: [{ id: "other-bank-credit-cards", bankId: "other-bank", name: "Other Bank Credit Cards" }],
      offers: []
    };
    const prior = catalogWith([
      scannedOffer({ bankId: "other-bank", cardId: "other-bank-credit-cards", firstSeenAt: "2020-01-01T00:00:00.000Z" })
    ]);

    const { catalog } = importBankOffers(entry, [scannedOffer()], REVIEW_DATE, seed, prior);

    // Both rows share an id here, so the row under test is the one belonging to the imported bank.
    expect(catalog.offers.find((o) => o.bankId === "test-bank")?.firstSeenAt).toBe(REVIEW_DATE);
  });
});

describe("importBankOffers enrichment", () => {
  it("enriches incoming offers, so no refresh path can skip enrichment", () => {
    const { catalog } = importBankOffers(entry, [scannedOffer()], REVIEW_DATE, emptySeed, catalogWith([]));

    expect(importedOffer(catalog, "test-bank-blue-orbit")).toMatchObject({
      offerType: "discount",
      discountPct: 25,
      validDays: ["fri"],
      cardNetworks: ["visa"],
      cardTypes: ["credit"]
    });
  });

  it("carries the enriched fields through to the seed offers", () => {
    const { seed } = importBankOffers(entry, [scannedOffer()], REVIEW_DATE, emptySeed, catalogWith([]));

    expect(seed.offers).toEqual([
      expect.objectContaining({ id: "test-bank-blue-orbit", offerType: "discount", discountPct: 25 })
    ]);
  });

  it("keeps enrichment values the incoming offer already carries", () => {
    const incoming = scannedOffer({ offerType: "cashback", discountPct: 5 });

    const { catalog } = importBankOffers(entry, [incoming], REVIEW_DATE, emptySeed, catalogWith([]));

    expect(importedOffer(catalog, "test-bank-blue-orbit")).toMatchObject({ offerType: "cashback", discountPct: 5 });
  });

  it("does not mutate the offers it was handed", () => {
    const incoming = scannedOffer();
    const snapshot = JSON.parse(JSON.stringify(incoming));

    importBankOffers(entry, [incoming], REVIEW_DATE, emptySeed, catalogWith([]));

    expect(incoming).toEqual(snapshot);
  });
});
