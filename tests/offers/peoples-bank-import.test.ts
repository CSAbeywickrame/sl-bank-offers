import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformPeoplesBankScrape } from "@/lib/offers/peoplesBankImport";

const reviewDate = "2026-06-10T00:00:00.000Z";

describe("People's Bank scrape import", () => {
  it("converts the June 10 People's Bank scrape into active scanned offers for CardCompass", () => {
    const raw = JSON.parse(readFileSync("data/peoplesbank-scrape-2026-06-10.json", "utf8")) as unknown;
    const offers = transformPeoplesBankScrape(raw, reviewDate);

    expect(offers).toHaveLength(190);
    expect(new Set(offers.map((offer) => offer.status))).toEqual(new Set(["active"]));
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(offers.length);
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "peoples-bank-keells-june-2026",
          cardId: "peoples-bank-credit-cards",
          category: "supermarket",
          merchant: "Keells",
          sourceUrl: "https://www.peoplesbank.lk/promotion/keells-25-off-credit/"
        }),
        expect.objectContaining({
          id: "peoples-bank-plates-june-2026",
          cardId: "peoples-bank-credit-cards",
          category: "dining",
          merchant: "Plates at Cinnamon Grand Colombo",
          sourceUrl: "https://www.peoplesbank.lk/promotion/plates-at-cinnamon-grand-colombo-30-off-credit/"
        }),
        expect.objectContaining({
          id: "peoples-bank-travel-installments-june-2026",
          cardId: "peoples-bank-credit-cards",
          category: "installment",
          merchant: "Travel",
          sourceUrl: "https://www.peoplesbank.lk/installments/?cardType=credit_card#travel"
        }),
        expect.objectContaining({
          id: "peoples-bank-crazyjets-25-off-june-2026",
          cardId: "peoples-bank-credit-cards",
          category: "travel",
          merchant: "www.crazyjets.com",
          sourceUrl: "https://www.peoplesbank.lk/promotion/www-crazyjets-com-25-off-credit/"
        }),
        expect.objectContaining({
          id: "peoples-bank-singapore-visa-offers",
          cardId: "peoples-bank-credit-cards",
          category: "other",
          sourceUrl: "https://www.peoplesbank.lk/promotion/singapore-visa-offers/"
        })
      ])
    );
  });
});
