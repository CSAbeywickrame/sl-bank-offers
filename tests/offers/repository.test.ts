import { describe, expect, it } from "vitest";
import { filterOffers } from "@/lib/offers/filter";
import { getActiveOffers } from "@/lib/offers/repository";

describe("seed repository", () => {
  it("surfaces the full Pan Asia Bank June 11 scrape as active offers", async () => {
    const offers = await getActiveOffers();
    const panAsiaOffers = offers.filter((offer) => offer.bankId === "pan-asia-bank");

    expect(panAsiaOffers).toHaveLength(6);
    expect(filterOffers(offers, { cardId: "pan-asia-bank-credit-cards" })).toHaveLength(6);
    expect(panAsiaOffers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pan-asia-bank-insurance-premium-payments-december-2026",
          category: "installment",
          merchant: "Insurance premium payments"
        }),
        expect.objectContaining({
          id: "pan-asia-bank-aminra-jewellers-june-2026",
          category: "other",
          merchant: "Aminra Jewellers"
        }),
        expect.objectContaining({
          id: "pan-asia-bank-softlogic-glomark-june-2026",
          category: "supermarket",
          merchant: "Softlogic Glomark"
        })
      ])
    );
  });

  it("surfaces the full NDB June 12 scrape as active offers with detail-page sources", async () => {
    const offers = await getActiveOffers();
    const ndbOffers = offers.filter((offer) => offer.bankId === "ndb");

    expect(ndbOffers).toHaveLength(98);
    expect(filterOffers(offers, { cardId: "ndb-credit-cards" })).toHaveLength(89);
    expect(filterOffers(offers, { cardId: "ndb-premium-credit-cards" })).toHaveLength(9);
    expect(ndbOffers.map((offer) => offer.sourceUrl)).not.toContain("https://www.ndbbank.com/cards/card-offers");
    expect(ndbOffers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ndb-findmyfare-june-2026",
          cardId: "ndb-credit-cards",
          category: "travel",
          merchant: "findmyfare.com"
        }),
        expect.objectContaining({
          id: "ndb-education-ipp-june-2026",
          cardId: "ndb-premium-credit-cards",
          category: "installment",
          merchant: "Education IPP promotion"
        }),
        expect.objectContaining({
          id: "ndb-visa-365-december-2026",
          cardId: "ndb-premium-credit-cards",
          category: "travel",
          merchant: "Visa"
        })
      ])
    );
  });

  it("surfaces the full Union Bank June 12 scrape as active offers", async () => {
    const offers = await getActiveOffers();
    const unionBankOffers = offers.filter((offer) => offer.bankId === "union-bank");

    expect(unionBankOffers).toHaveLength(14);
    expect(filterOffers(offers, { cardId: "union-bank-credit-cards" })).toHaveLength(14);
    expect(unionBankOffers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "union-bank-nh-bentota-ceysands-resort-august-2026",
          category: "travel",
          merchant: "NH Bentota Ceysands Resort"
        }),
        expect.objectContaining({
          id: "union-bank-glomark-softlogic-supermarkets-june-2026",
          category: "supermarket",
          merchant: "Glomark - Softlogic Supermarkets"
        }),
        expect.objectContaining({
          id: "union-bank-fuel-cashback-june-2026",
          category: "cashback",
          merchant: "Fuel Cashback"
        }),
        expect.objectContaining({
          id: "union-bank-ub-24-june-2026",
          category: "installment",
          merchant: "UB 24"
        }),
        expect.objectContaining({
          id: "union-bank-travel-leisure-june-2026",
          category: "installment",
          merchant: "Travel & Leisure"
        })
      ])
    );
  });

  it("surfaces the live Cargills Bank June 12 scrape as active offers", async () => {
    const offers = await getActiveOffers();
    const cargillsOffers = offers.filter((offer) => offer.bankId === "cargills-bank");

    expect(cargillsOffers).toHaveLength(23);
    expect(filterOffers(offers, { cardId: "cargills-bank-mastercard-credit-cards" })).toHaveLength(23);
    expect(cargillsOffers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cargills-bank-banana-bunks-kandy-july-2026",
          category: "travel",
          merchant: "Banana Bunks - Kandy"
        }),
        expect.objectContaining({
          id: "cargills-bank-atlas-june-2026",
          category: "online",
          merchant: "Atlas"
        }),
        expect.objectContaining({
          id: "cargills-bank-crazy-jets-june-2026",
          category: "travel",
          merchant: "Crazy Jets"
        }),
        expect.objectContaining({
          id: "cargills-bank-solar-0-instalment-plan-december-2026",
          category: "installment",
          merchant: "Solar 0% Instalment Plan"
        }),
        expect.objectContaining({
          id: "cargills-bank-call-and-card-balance",
          category: "other",
          merchant: "Call and Card Balance"
        })
      ])
    );
  });
});
