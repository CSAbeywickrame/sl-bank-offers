import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformCargillsScrape } from "@/lib/offers/cargillsImport";

const reviewDate = "2026-06-12T00:00:00.000Z";

describe("Cargills Bank scrape import", () => {
  it("converts the June 12 Cargills Bank scrape into active scanned offers for CardCompass", () => {
    const raw = JSON.parse(readFileSync("data/cargills-scrape-2026-06-12.json", "utf8")) as unknown;
    const offers = transformCargillsScrape(raw, reviewDate);

    expect(offers).toHaveLength(23);
    expect(new Set(offers.map((offer) => offer.status))).toEqual(new Set(["active"]));
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(offers.length);
    expect(offers.find((offer) => offer.sourceUrl.includes("Araliya-Hotels"))).toBeUndefined();
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cargills-bank-banana-bunks-kandy-july-2026",
          cardId: "cargills-bank-mastercard-credit-cards",
          category: "travel",
          merchant: "Banana Bunks - Kandy",
          sourceUrl:
            "https://www.cargillsbank.com/wp-content/uploads/2026/04/Banana-Bunks-Kandy-Offer-Terms-and-Conditions.pdf"
        }),
        expect.objectContaining({
          id: "cargills-bank-cargills-food-city-cargills-express-cargills-food-hall-july-2026",
          cardId: "cargills-bank-mastercard-credit-cards",
          category: "supermarket",
          merchant: "Cargills Food City, Cargills Express & Cargills Food Hall",
          sourceUrl: "https://www.cargillsbank.com/wp-content/uploads/2018/04/Fresh-Feast-offer-Terms-and-Conditions-1.pdf"
        }),
        expect.objectContaining({
          id: "cargills-bank-crazy-jets-june-2026",
          cardId: "cargills-bank-mastercard-credit-cards",
          category: "travel",
          merchant: "Crazy Jets",
          sourceUrl: "https://www.cargillsbank.com/wp-content/uploads/2018/04/Crazy-Jets-Terms-and-Conditions.pdf"
        }),
        expect.objectContaining({
          id: "cargills-bank-solar-0-instalment-plan-december-2026",
          cardId: "cargills-bank-mastercard-credit-cards",
          category: "installment",
          merchant: "Solar 0% Instalment Plan",
          sourceUrl: "https://www.cargillsbank.com/wp-content/uploads/2018/04/36-months-Solar-Terms-and-Conditions.pdf"
        }),
        expect.objectContaining({
          id: "cargills-bank-mastercard-golf-program",
          cardId: "cargills-bank-mastercard-credit-cards",
          category: "other",
          merchant: "Mastercard Golf Program",
          sourceUrl: "https://www.cargillsbank.com/products/mastercard-promotions/"
        })
      ])
    );
  });
});
