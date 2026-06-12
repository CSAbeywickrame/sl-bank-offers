import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformBocScrape } from "@/lib/offers/bocImport";

const reviewDate = "2026-06-11T00:00:00.000Z";

describe("BOC scrape import", () => {
  it("converts the June 11 BOC scrape into active scanned offers for CardCompass", () => {
    const raw = JSON.parse(readFileSync("data/boc-scrape-2026-06-11.json", "utf8")) as unknown;
    const offers = transformBocScrape(raw, reviewDate);

    expect(offers).toHaveLength(73);
    expect(new Set(offers.map((offer) => offer.status))).toEqual(new Set(["active"]));
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(offers.length);
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "boc-keells-june-2026",
          cardId: "boc-credit-cards",
          category: "supermarket",
          merchant: "Keells",
          sourceUrl: "https://www.boc.lk/personal-banking/card-offers/supermarkets/keells/product"
        }),
        expect.objectContaining({
          id: "boc-air-tickets-august-2026",
          cardId: "boc-credit-cards",
          category: "installment",
          merchant: "Air Tickets",
          sourceUrl: "https://www.boc.lk/personal-banking/card-offers/zero-plans/air-tickets/product"
        }),
        expect.objectContaining({
          id: "boc-crazy-jets-june-2026",
          cardId: "boc-credit-cards",
          category: "travel",
          merchant: "Crazy Jets",
          sourceUrl: "https://www.boc.lk/personal-banking/card-offers/online/crazy-jets/product"
        }),
        expect.objectContaining({
          id: "boc-anantaya-resort-spa-1-june-2026",
          cardId: "boc-credit-cards",
          category: "travel",
          merchant: "Anantaya Resort & Spa",
          sourceUrl: "https://www.boc.lk/personal-banking/card-offers/travel-and-leisure/anantaya-resort-spa-1/product"
        }),
        expect.objectContaining({
          id: "boc-thursdays-taste-better-with-boc-visa-cards-july-2026",
          cardId: "boc-credit-cards",
          category: "dining",
          merchant: "Thursdays Taste Better with BOC Visa Cards",
          sourceUrl:
            "https://www.boc.lk/personal-banking/card-offers/visa-offers/thursdays-taste-better-with-boc-visa-cards/product"
        })
      ])
    );
  });
});
