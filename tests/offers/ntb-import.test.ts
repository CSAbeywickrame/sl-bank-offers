import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformNtbScrape } from "@/lib/offers/ntbImport";

const reviewDate = "2026-06-10T00:00:00.000Z";

describe("NTB scrape import", () => {
  it("converts the June 10 NTB scrape into active scanned offers for CardCompass", () => {
    const raw = JSON.parse(readFileSync("data/ntb-scrape-2026-06-10.json", "utf8")) as unknown;
    const offers = transformNtbScrape(raw, reviewDate);
    const privateBankingOffers = offers.filter((offer) => offer.cardId === "ntb-private-banking-mastercard-credit-cards");

    expect(offers).toHaveLength(143);
    expect(privateBankingOffers).toHaveLength(10);
    expect(new Set(offers.map((offer) => offer.status))).toEqual(new Set(["active"]));
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ntb-butlers-june-2026",
          cardId: "ntb-mastercard-credit-cards",
          category: "dining",
          merchant: "Butlers",
          sourceUrl: "https://www.nationstrust.com/promotions/enjoy-exclusive-savings-on-dining"
        }),
        expect.objectContaining({
          id: "ntb-cargills-online-july-2026",
          cardId: "ntb-mastercard-credit-cards",
          category: "online",
          merchant: "Cargills Online",
          sourceUrl: "https://www.nationstrust.com/promotions/enjoy-exclusive-savings-when-you-shop-online-with-nations-trust-bank-mastercard-cards"
        }),
        expect.objectContaining({
          id: "ntb-installments-june-2026",
          cardId: "ntb-mastercard-credit-cards",
          category: "installment",
          sourceUrl: "https://www.nationstrust.com/promotions/enjoy-installment-plans-at-a-range-of-merchant-partners"
        }),
        expect.objectContaining({
          cardId: "ntb-private-banking-mastercard-credit-cards",
          category: "travel",
          merchant: "Jetwing Hotels",
          sourceUrl: "https://www.nationstrust.com/promotions/enjoy-exclusive-savings-with-private-banking-mastercard-credit-cards"
        })
      ])
    );
    expect(
      offers.filter(
        (offer) =>
          offer.sourceUrl === "https://www.nationstrust.com/promotions/enjoy-exclusive-savings-with-private-banking-mastercard-credit-cards" &&
          offer.cardId !== "ntb-private-banking-mastercard-credit-cards"
      )
    ).toHaveLength(0);
  });
});
