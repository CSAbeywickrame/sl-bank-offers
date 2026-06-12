import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformNdbScrape } from "@/lib/offers/ndbImport";

const reviewDate = "2026-06-12T00:00:00.000Z";

describe("NDB scrape import", () => {
  it("converts the June 12 NDB scrape into active scanned offers for CardCompass", () => {
    const raw = JSON.parse(readFileSync("data/ndb-scrape-2026-06-12.json", "utf8")) as unknown;
    const offers = transformNdbScrape(raw, reviewDate);

    expect(offers).toHaveLength(98);
    expect(new Set(offers.map((offer) => offer.status))).toEqual(new Set(["active"]));
    expect(new Set(offers.map((offer) => offer.id)).size).toBe(offers.length);
    expect(offers.filter((offer) => offer.cardId === "ndb-premium-credit-cards")).toHaveLength(9);
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ndb-findmyfare-june-2026",
          cardId: "ndb-credit-cards",
          category: "travel",
          merchant: "findmyfare.com",
          validUntil: "2026-06-30",
          sourceUrl: "https://www.ndbbank.com/cards/card-offers/offer-details/247"
        }),
        expect.objectContaining({
          id: "ndb-education-ipp-june-2026",
          cardId: "ndb-premium-credit-cards",
          category: "installment",
          merchant: "Education IPP promotion",
          validUntil: "2026-06-30",
          sourceUrl: "https://www.ndbbank.com/cards/card-offers/offer-details/316"
        }),
        expect.objectContaining({
          id: "ndb-hemas-consumer-brands-364",
          cardId: "ndb-credit-cards",
          category: "online",
          merchant: "Hemas Consumer Brands",
          validUntil: undefined,
          sourceUrl: "https://www.ndbbank.com/cards/card-offers/offer-details/364"
        }),
        expect.objectContaining({
          id: "ndb-visa-365-december-2026",
          cardId: "ndb-premium-credit-cards",
          category: "travel",
          merchant: "Visa",
          validUntil: "2026-12-31",
          sourceUrl: "https://www.ndbbank.com/cards/card-offers/offer-details/365"
        }),
        expect.objectContaining({
          id: "ndb-colombo-kitchen-sheraton-colombo-490-june-2026",
          cardId: "ndb-credit-cards",
          category: "dining",
          merchant: "Colombo Kitchen - Sheraton Colombo",
          validUntil: "2026-06-30",
          sourceUrl: "https://www.ndbbank.com/cards/card-offers/offer-details/490"
        })
      ])
    );
  });
});
