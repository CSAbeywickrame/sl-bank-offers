import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformStandardCharteredScrape } from "@/lib/offers/standardCharteredImport";

const reviewDate = "2026-06-11T00:00:00.000Z";

describe("Standard Chartered scrape import", () => {
  it("converts the June 11 Standard Chartered scrape into active scanned offers for CardCompass", () => {
    const raw = JSON.parse(readFileSync("data/stanchart-scrape-2026-06-11.json", "utf8")) as unknown;
    const offers = transformStandardCharteredScrape(raw, reviewDate);

    expect(offers).toHaveLength(26);
    expect(new Set(offers.map((offer) => offer.status))).toEqual(new Set(["active"]));
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(offers.length);
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "standard-chartered-aarawild-kandalama-june-2026",
          cardId: "standard-chartered-credit-cards",
          category: "travel",
          merchant: "Aarawild Kandalama",
          sourceUrl: "https://www.sc.com/lk/data/tgl/offers.json"
        }),
        expect.objectContaining({
          id: "standard-chartered-aq2o-june-2026",
          cardId: "standard-chartered-credit-cards",
          category: "installment",
          merchant: "AQ2O",
          sourceUrl: "https://www.sc.com/lk/data/tgl/offers.json"
        }),
        expect.objectContaining({
          id: "standard-chartered-pearl-bay-june-2026",
          cardId: "standard-chartered-credit-cards",
          category: "other",
          merchant: "Pearl Bay",
          sourceUrl: "https://www.sc.com/lk/data/tgl/offers.json"
        }),
        expect.objectContaining({
          id: "standard-chartered-crazy-jets-june-2026",
          cardId: "standard-chartered-credit-cards",
          category: "travel",
          merchant: "Crazy Jets",
          sourceUrl: "https://www.sc.com/lk/data/tgl/offers.json"
        }),
        expect.objectContaining({
          id: "standard-chartered-singer-june-2026",
          cardId: "standard-chartered-credit-cards",
          category: "installment",
          merchant: "Singer",
          sourceUrl: "https://www.sc.com/lk/data/tgl/offers.json"
        })
      ])
    );
  });
});
