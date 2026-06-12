import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformDfccScrape } from "@/lib/offers/dfccImport";

const reviewDate = "2026-06-12T00:00:00.000Z";

describe("DFCC scrape import", () => {
  it("converts the June 12 DFCC scrape into active scanned offers for CardCompass", () => {
    const raw = JSON.parse(readFileSync("data/dfcc-scrape-2026-06-12.json", "utf8")) as unknown;
    const offers = transformDfccScrape(raw, reviewDate);

    expect(offers).toHaveLength(143);
    expect(new Set(offers.map((offer) => offer.status))).toEqual(new Set(["active"]));
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(offers.length);
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "dfcc-06-and-12-months-0-easy-payment-plans-on-autocare-payments-over-rs-25-000-with-dfcc-credit-cards-august-2026",
          cardId: "dfcc-credit-cards",
          category: "installment",
          sourceUrl: "https://www.dfcc.lk/cards/cards-promotions/06-and-12-months-0-easy-payment-plans-on-autocare-payments-over-rs-25-000-with-dfcc-credit-cards"
        }),
        expect.objectContaining({
          id: "dfcc-a-and-m-cupcakes-july-2026",
          cardId: "dfcc-credit-cards",
          category: "dining",
          merchant: "A & M Cupcakes",
          sourceUrl: "https://www.dfcc.lk/cards/cards-promotions/a-and-m-cupcakes"
        }),
        expect.objectContaining({
          id: "dfcc-aarawild-luxury-villas-kandalama-july-2026",
          cardId: "dfcc-credit-cards",
          category: "travel",
          merchant: "Aarawild Luxury Villas",
          sourceUrl: "https://www.dfcc.lk/cards/cards-promotions/aarawild-luxury-villas-kandalama"
        }),
        expect.objectContaining({
          id: "dfcc-cargills-food-city-june-2026",
          cardId: "dfcc-credit-cards",
          category: "supermarket",
          merchant: "Cargills Food City",
          sourceUrl: "https://www.dfcc.lk/cards/cards-promotions/cargills-food-city"
        })
      ])
    );
  });
});
