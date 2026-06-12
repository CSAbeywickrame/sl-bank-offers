import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformUnionBankScrape } from "@/lib/offers/unionBankImport";

const reviewDate = "2026-06-12T00:00:00.000Z";

describe("Union Bank scrape import", () => {
  it("converts the June 12 Union Bank scrape into active scanned offers for CardCompass", () => {
    const raw = JSON.parse(readFileSync("data/union-bank-scrape-2026-06-12.json", "utf8")) as unknown;
    const offers = transformUnionBankScrape(raw, reviewDate);

    expect(offers).toHaveLength(14);
    expect(new Set(offers.map((offer) => offer.status))).toEqual(new Set(["active"]));
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(offers.length);
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "union-bank-nh-bentota-ceysands-resort-august-2026",
          cardId: "union-bank-credit-cards",
          category: "travel",
          merchant: "NH Bentota Ceysands Resort",
          sourceUrl: "https://www.unionb.com/offer/nh-bentota-ceysands-resort/"
        }),
        expect.objectContaining({
          id: "union-bank-glomark-softlogic-supermarkets-june-2026",
          cardId: "union-bank-credit-cards",
          category: "supermarket",
          merchant: "Glomark - Softlogic Supermarkets",
          sourceUrl: "https://www.unionb.com/offer/32176/"
        }),
        expect.objectContaining({
          id: "union-bank-fuel-cashback-june-2026",
          cardId: "union-bank-credit-cards",
          category: "cashback",
          merchant: "Fuel Cashback",
          sourceUrl: "https://www.unionb.com/offer/ub-supper-offer/"
        }),
        expect.objectContaining({
          id: "union-bank-ub-24-june-2026",
          cardId: "union-bank-credit-cards",
          category: "installment",
          merchant: "UB 24",
          sourceUrl: "https://www.unionb.com/offer/ub-24/"
        }),
        expect.objectContaining({
          id: "union-bank-travel-leisure-june-2026",
          cardId: "union-bank-credit-cards",
          category: "installment",
          merchant: "Travel & Leisure",
          sourceUrl: "https://www.unionb.com/offer/0-travel-leisure/"
        })
      ])
    );
  });
});
