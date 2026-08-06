import { describe, expect, it } from "vitest";
import { dedupeOffers } from "@/lib/ingest/importBank";

interface DedupeFixture {
  id: string;
  cardId: string;
  merchant?: string;
  description?: string;
  title?: string;
  sourceUrl?: string;
  validUntil?: string;
}

const baseOffer = (overrides: Partial<DedupeFixture> = {}): DedupeFixture => ({
  id: "offer-1",
  cardId: "hnb-visa-signature",
  merchant: "Blue Orbit",
  description: "15% off dining at Blue Orbit",
  title: "15% off at Blue Orbit",
  sourceUrl: "https://example.com/blue-orbit",
  ...overrides
});

describe("dedupeOffers", () => {
  it("collapses two rows with the same id to one, keeping the first occurrence", () => {
    const offers: DedupeFixture[] = [
      baseOffer({ id: "offer-1", description: "First description" }),
      baseOffer({ id: "offer-1", description: "Second description" })
    ];

    const result = dedupeOffers(offers);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "offer-1", description: "First description" });
  });

  it("collapses semantic duplicates (same cardId + merchant + description via different URLs), keeping the richer record", () => {
    const offers: DedupeFixture[] = [
      baseOffer({ id: "offer-a", sourceUrl: "https://example.com/promo-a" }),
      baseOffer({ id: "offer-b", sourceUrl: "https://example.com/promo-b", validUntil: "2026-12-31" })
    ];

    const result = dedupeOffers(offers);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("offer-b");
    expect(result[0].validUntil).toBe("2026-12-31");
  });

  it("keeps offers with the same generic title and description but different merchants unmerged", () => {
    const offers: DedupeFixture[] = [
      baseOffer({
        id: "offer-x",
        merchant: "Merchant A",
        title: "20% off with Mastercard Credit Cards",
        description: "Enjoy 20% off with your Mastercard Credit Card"
      }),
      baseOffer({
        id: "offer-y",
        merchant: "Merchant B",
        title: "20% off with Mastercard Credit Cards",
        description: "Enjoy 20% off with your Mastercard Credit Card"
      })
    ];

    const result = dedupeOffers(offers);

    expect(result).toHaveLength(2);
    expect(result.map((o) => o.id)).toEqual(["offer-x", "offer-y"]);
  });

  it("keeps offers with no merchant and no description as-is, without grouping them together", () => {
    // title must also be cleared here: it's now the identity-anchor fallback when merchant is
    // absent, so leaving baseOffer's default title in place would give both rows a real anchor
    // and collapse them — defeating the "no identity signal at all" case this test exercises.
    const offers: DedupeFixture[] = [
      baseOffer({ id: "offer-p", merchant: undefined, title: undefined, description: undefined }),
      baseOffer({ id: "offer-q", merchant: undefined, title: undefined, description: undefined })
    ];

    const result = dedupeOffers(offers);

    expect(result).toHaveLength(2);
    expect(result.map((o) => o.id)).toEqual(["offer-p", "offer-q"]);
  });

  it("preserves first-occurrence order of survivors when a duplicate is removed from the middle of the input", () => {
    const offers: DedupeFixture[] = [
      baseOffer({ id: "offer-1", cardId: "card-a", merchant: "Merchant 1", description: "Desc 1" }),
      baseOffer({ id: "offer-2", cardId: "card-b", merchant: "Merchant 2", description: "Desc 2" }),
      baseOffer({ id: "offer-2-dup", cardId: "card-b", merchant: "Merchant 2", description: "Desc 2" }),
      baseOffer({ id: "offer-3", cardId: "card-c", merchant: "Merchant 3", description: "Desc 3" })
    ];

    const result = dedupeOffers(offers);

    expect(result.map((o) => o.id)).toEqual(["offer-1", "offer-2", "offer-3"]);
  });

  it("does not mutate the input array or the offer objects within it", () => {
    const offers: DedupeFixture[] = [
      baseOffer({ id: "offer-1", cardId: "card-a", merchant: "Merchant 1", description: "Desc 1" }),
      baseOffer({ id: "offer-1", cardId: "card-a", merchant: "Merchant 1", description: "Duplicate row" }),
      baseOffer({ id: "offer-2", cardId: "card-b", merchant: "Merchant 2", description: "Desc 2" })
    ];
    const snapshot = JSON.parse(JSON.stringify(offers));

    dedupeOffers(offers);

    expect(offers).toEqual(snapshot);
    expect(offers).toHaveLength(3);
  });

  // Real-data regression: these union-bank rows all had merchant: undefined and shared the
  // boilerplate description "25% OFF (Monday to Friday)", so keying pass 2 on description alone
  // collapsed 15 distinct merchant offers into 1. The title carries the merchant name here, so
  // the identity anchor must fall back to title when merchant is absent — all 15 must survive.
  it("keeps distinct merchants with no merchant field and a shared boilerplate description separate (union-bank regression)", () => {
    const offers: DedupeFixture[] = [
      baseOffer({ id: "union-1", cardId: "union-bank-credit-cards", merchant: undefined, title: "ODEL", description: "25% OFF (Monday to Friday)" }),
      baseOffer({ id: "union-2", cardId: "union-bank-credit-cards", merchant: undefined, title: "Cotton Collection", description: "25% OFF (Monday to Friday)" }),
      baseOffer({ id: "union-3", cardId: "union-bank-credit-cards", merchant: undefined, title: "Samsonite", description: "25% OFF (Monday to Friday)" })
    ];

    const result = dedupeOffers(offers);

    expect(result).toHaveLength(3);
    expect(result.map((o) => o.id)).toEqual(["union-1", "union-2", "union-3"]);
  });

  it("does not collapse the same merchant + description across two different cardIds", () => {
    const offers: DedupeFixture[] = [
      baseOffer({ id: "offer-a", cardId: "card-a", merchant: "Blue Orbit", description: "15% off dining" }),
      baseOffer({ id: "offer-b", cardId: "card-b", merchant: "Blue Orbit", description: "15% off dining" })
    ];

    const result = dedupeOffers(offers);

    expect(result).toHaveLength(2);
    expect(result.map((o) => o.id)).toEqual(["offer-a", "offer-b"]);
  });

  it("normalizes merchant names before comparing, so punctuation/case/spacing variants collapse", () => {
    const offers: DedupeFixture[] = [
      baseOffer({ id: "offer-a", merchant: "Blue Orbit!", description: "15% off dining" }),
      baseOffer({ id: "offer-b", merchant: "blue  orbit", description: "15% off dining", validUntil: "2026-12-31" })
    ];

    const result = dedupeOffers(offers);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("offer-b");
  });

  it("collapses two rows sharing a description but with no merchant and no title (no identity anchor to distinguish them)", () => {
    const offers: DedupeFixture[] = [
      baseOffer({ id: "offer-a", merchant: undefined, title: undefined, description: "10% off weekends" }),
      baseOffer({ id: "offer-b", merchant: undefined, title: undefined, description: "10% off weekends", validUntil: "2026-12-31" })
    ];

    const result = dedupeOffers(offers);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("offer-b");
  });
});
