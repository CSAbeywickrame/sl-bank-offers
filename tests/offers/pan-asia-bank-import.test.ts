import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformPanAsiaBankScrape } from "@/lib/offers/panAsiaBankImport";

const reviewDate = "2026-06-11T00:00:00.000Z";

describe("Pan Asia Bank scrape import", () => {
  it("converts the June 11 Pan Asia Bank scrape into active scanned offers for CardCompass", () => {
    const raw = JSON.parse(readFileSync("data/pan-asia-bank-scrape-2026-06-11.json", "utf8")) as unknown;
    const offers = transformPanAsiaBankScrape(raw, reviewDate);

    expect(offers).toHaveLength(6);
    expect(new Set(offers.map((offer) => offer.status))).toEqual(new Set(["active"]));
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(offers.length);
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pan-asia-bank-insurance-premium-payments-december-2026",
          cardId: "pan-asia-bank-credit-cards",
          category: "installment",
          merchant: "Insurance premium payments",
          sourceUrl: "https://www.pabcbank.com/card-offers/"
        }),
        expect.objectContaining({
          id: "pan-asia-bank-aminra-jewellers-june-2026",
          cardId: "pan-asia-bank-credit-cards",
          category: "other",
          merchant: "Aminra Jewellers",
          sourceUrl: "https://www.pabcbank.com/card-offers/"
        }),
        expect.objectContaining({
          id: "pan-asia-bank-keells-supermarket-june-2026",
          cardId: "pan-asia-bank-credit-cards",
          category: "supermarket",
          merchant: "Keells Supermarket",
          sourceUrl: "https://www.pabcbank.com/card-offers/"
        }),
        expect.objectContaining({
          id: "pan-asia-bank-lyceum-campus-december-2026",
          cardId: "pan-asia-bank-credit-cards",
          category: "installment",
          merchant: "Lyceum Campus",
          sourceUrl: "https://www.pabcbank.com/card-offers/"
        })
      ])
    );
  });
});
