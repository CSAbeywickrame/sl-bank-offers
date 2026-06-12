import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformSampathScrape } from "@/lib/offers/sampathImport";

const reviewDate = "2026-06-12T00:00:00.000Z";

describe("Sampath scrape import", () => {
  it("converts the June 12 Sampath scrape into active scanned offers for CardCompass", () => {
    const raw = JSON.parse(readFileSync("data/sampath-scrape-2026-06-12.json", "utf8")) as unknown;
    const offers = transformSampathScrape(raw, reviewDate);

    expect(offers).toHaveLength(113);
    expect(new Set(offers.map((offer) => offer.status))).toEqual(new Set(["active"]));
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(offers.length);
    expect(offers.filter((offer) => offer.cardId === "sampath-premium-credit-cards")).toHaveLength(9);
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "sampath-blooming-breakfast-resto-bar-cafe-2453-june-2026",
          cardId: "sampath-credit-cards",
          category: "dining",
          merchant: "Blooming Breakfast Resto Bar & Cafe",
          validUntil: "2026-06-30",
          sourceUrl: "https://www.sampath.lk/sampath-cards/credit-card-offer/2453"
        }),
        expect.objectContaining({
          id: "sampath-cheers-cinnamon-grand-colombo-2450-june-2026",
          cardId: "sampath-premium-credit-cards",
          category: "dining",
          merchant: "Cheers - Cinnamon Grand Colombo",
          validUntil: "2026-06-30",
          sourceUrl: "https://www.sampath.lk/sampath-cards/credit-card-offer/2450"
        }),
        expect.objectContaining({
          id: "sampath-abans-2407-june-2026",
          cardId: "sampath-credit-cards",
          category: "installment",
          merchant: "Abans",
          validUntil: "2026-06-30",
          sourceUrl: "https://www.sampath.lk/sampath-cards/credit-card-offer/2407"
        }),
        expect.objectContaining({
          id: "sampath-agoda-com-1672-september-2026",
          cardId: "sampath-premium-credit-cards",
          category: "travel",
          merchant: "Agoda.com",
          validUntil: "2026-09-30",
          sourceUrl: "https://www.sampath.lk/sampath-cards/credit-card-offer/1672"
        }),
        expect.objectContaining({
          id: "sampath-atlas-axillia-company-pvt-ltd-2369-june-2026",
          cardId: "sampath-credit-cards",
          category: "online",
          merchant: "Atlas Axillia Company (Pvt) Ltd",
          validUntil: "2026-06-30",
          sourceUrl: "https://www.sampath.lk/sampath-cards/credit-card-offer/2369"
        })
      ])
    );
  });
});
