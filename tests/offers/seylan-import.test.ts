import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformSeylanScrape } from "@/lib/offers/seylanImport";

const reviewDate = "2026-06-12T00:00:00.000Z";

describe("Seylan Bank scrape import", () => {
  it("converts the June 12 Seylan scrape into active scanned offers for CardCompass", () => {
    const raw = JSON.parse(readFileSync("data/seylan-scrape-2026-06-12.json", "utf8")) as unknown;
    const offers = transformSeylanScrape(raw, reviewDate);

    expect(offers).toHaveLength(195);
    expect(new Set(offers.map((offer) => offer.status))).toEqual(new Set(["active"]));
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(offers.length);
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "seylan-fuel-offer-2026-1-december-2026",
          cardId: "seylan-credit-cards",
          category: "cashback",
          merchant: "FUEL OFFER 2026",
          title: "5% cashback on fuel transactions",
          sourceUrl: "https://www.seylan.lk/fuel-offer-2026-1"
        }),
        expect.objectContaining({
          id: "seylan-chinese-dragon-cafe-1-july-2026",
          cardId: "seylan-credit-cards",
          category: "dining",
          merchant: "CHINESE DRAGON CAFE",
          sourceUrl: "https://www.seylan.lk/chinese-dragon-cafe-1"
        }),
        expect.objectContaining({
          id: "seylan-cinnamon-lakeside-june-2026",
          cardId: "seylan-credit-cards",
          category: "travel",
          merchant: "Cinnamon Lakeside Colombo",
          sourceUrl: "https://www.seylan.lk/promotions/cards/local-travel/cinnamon-lakeside"
        }),
        expect.objectContaining({
          id: "seylan-spar-visa-infinite-offer-1",
          cardId: "seylan-credit-cards",
          category: "supermarket",
          merchant: "SPAR VISA INFINITE OFFER",
          sourceUrl: "https://www.seylan.lk/spar-visa-infinite-offer-1",
          validUntil: undefined
        })
      ])
    );
  });
});
