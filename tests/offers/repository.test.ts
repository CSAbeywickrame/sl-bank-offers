import { describe, expect, it } from "vitest";
import { filterOffers } from "@/lib/offers/filter";
import { getActiveOffers, getSeedData } from "@/lib/offers/repository";

describe("seed repository", () => {
  it("loads a curated Sri Lankan bank offer seed with source metadata", async () => {
    const seed = await getSeedData();
    const bankIds = new Set(seed.banks.map((bank) => bank.id));
    const categories = new Set(seed.offers.map((offer) => offer.category));
    const offerBankIds = new Set(
      seed.offers
        .map((offer) => seed.cards.find((card) => card.id === offer.cardId)?.bankId)
        .filter((bankId): bankId is string => Boolean(bankId))
    );

    expect(bankIds).toEqual(
      new Set(["commercial-bank", "ndb", "boc", "peoples-bank", "ntb", "pan-asia-bank", "sampath", "standard-chartered", "union-bank", "cargills-bank", "dfcc", "seylan"])
    );
    expect(seed.cards.length).toBeGreaterThanOrEqual(15);
    expect(seed.offers.length).toBeGreaterThanOrEqual(717);
    expect(offerBankIds).toEqual(bankIds);
    expect([...categories]).toEqual(expect.arrayContaining(["dining", "supermarket", "travel", "installment", "online", "other"]));

    for (const offer of seed.offers) {
      expect(offer.status).toBe("active");
      expect(offer.sourceUrl).toMatch(/^https:\/\//);
      expect(offer.termsLink).toMatch(/^https:\/\//);
      expect(offer.lastReviewedAt).toMatch(/^2026-06-(09|10|11|12)T00:00:00\.000Z$/);
    }
  });

  it("includes 14 Commercial Bank dining offers from the June 10 scrape", async () => {
    const seed = await getSeedData();
    const commercialDiningOffers = seed.offers
      .filter((offer) => offer.cardId === "commercial-bank-credit-cards" && offer.category === "dining")
      .map((offer) => offer.id)
      .sort();

    expect(commercialDiningOffers).toEqual([
      "commercial-bank-blue-orbit-citrus-june-2026",
      "commercial-bank-ceylon-curry-club-june-2026",
      "commercial-bank-cinnamon-red-june-2026",
      "commercial-bank-courtyard-marriott-june-2026",
      "commercial-bank-doubletree-weerawila-june-2026",
      "commercial-bank-favourite-restaurants-nov-2026",
      "commercial-bank-galle-face-hotel-june-2026",
      "commercial-bank-hilton-colombo-june-2026",
      "commercial-bank-hilton-residences-june-2026",
      "commercial-bank-jetwing-hotels-june-2026",
      "commercial-bank-nh-collection-june-2026",
      "commercial-bank-ramada-june-2026",
      "commercial-bank-softlogic-restaurants-june-2026",
      "commercial-bank-visa-thursday-dining-july-2026"
    ]);
  });

  it("includes 15 Commercial Bank premium-section offers from the June 10 scrape", async () => {
    const seed = await getSeedData();
    const premiumSectionOffers = seed.offers
      .filter((offer) => offer.sourceUrl.includes("/premium-card-offers/"))
      .map((offer) => ({
        id: offer.id,
        cardId: offer.cardId,
        sourceUrl: offer.sourceUrl
      }))
      .sort((left, right) => left.id.localeCompare(right.id));

    expect(premiumSectionOffers).toEqual([
      {
        id: "commercial-bank-platinum-debit-blue-orbit-citrus-june-2026",
        cardId: "commercial-bank-platinum-debit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/enjoy-the-art-of-dining-at-blue-orbit-by-citrus-with-combank-platinum-debit-cards"
      },
      {
        id: "commercial-bank-premium-blue-orbit-citrus-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/enjoy-the-art-of-dining-at-blue-orbit-by-citrus-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-ceylon-curry-club-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/enjoy-the-art-of-dining-at-ceylon-curry-club-and-co-pub-and-kitchen-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-china-duty-free-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/shop-duty-free-now-and-pay-later-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-cinnamon-red-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/enjoy-the-art-of-dining-at-cinnamon-red-colombo-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-doubletree-weerawila-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/enjoy-the-art-of-dining-at-double-tree-by-hilton-weerawila-rajawarna-resort-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-galle-face-hotel-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/enjoy-the-art-of-dining-at-galle-face-hotel-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-hilton-colombo-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/enjoy-the-art-of-dining-at-hilton-colombo-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-hilton-residences-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/enjoy-the-art-of-dining-at-hilton-colombo-residences-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-jetwing-hotels-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/enjoy-the-art-of-dining-at-jetwing-hotels-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-keells-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/enjoy-exclusive-supermarket-deals-at-keells-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-minor-hotels-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/relax-at-your-favourite-holiday-destination-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-nh-collection-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/enjoy-the-art-of-dining-at-nh-collection-colombo-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-ramada-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/enjoy-the-art-of-dining-at-ramada-with-combank-premium-credit-cards"
      },
      {
        id: "commercial-bank-premium-softlogic-glomark-june-2026",
        cardId: "commercial-bank-premium-credit-cards",
        sourceUrl:
          "https://www.combank.lk/rewards-promotion/premium-card-offers/exclusive-supermarket-deals-at-softlogic-glomark-with-combank-premium-credit-cards"
      }
    ]);
  });

  it("projects seed offers into queryable listing rows", async () => {
    const offers = await getActiveOffers();
    const commercialDiningOfferIds = filterOffers(offers, { bankId: "commercial-bank", category: "dining" })
      .map((offer) => offer.id)
      .sort();

    expect(offers.length).toBeGreaterThanOrEqual(10);
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bankId: "commercial-bank",
          bankName: "Commercial Bank of Ceylon"
        }),
        expect.objectContaining({
          bankId: "ndb",
          bankName: "National Development Bank"
        }),
        expect.objectContaining({
          bankId: "boc",
          bankName: "Bank of Ceylon"
        }),
        expect.objectContaining({
          bankId: "peoples-bank",
          bankName: "People's Bank"
        }),
        expect.objectContaining({
          bankId: "ntb",
          bankName: "Nations Trust Bank"
        }),
        expect.objectContaining({
          bankId: "pan-asia-bank",
          bankName: "Pan Asia Bank"
        }),
        expect.objectContaining({
          bankId: "sampath",
          bankName: "Sampath Bank"
        }),
        expect.objectContaining({
          bankId: "standard-chartered",
          bankName: "Standard Chartered Sri Lanka"
        }),
        expect.objectContaining({
          bankId: "union-bank",
          bankName: "Union Bank of Colombo"
        }),
        expect.objectContaining({
          bankId: "cargills-bank",
          bankName: "Cargills Bank"
        })
      ])
    );
    expect(filterOffers(offers, { category: "installment" }).length).toBeGreaterThanOrEqual(2);
    expect(filterOffers(offers, { category: "travel" }).length).toBeGreaterThanOrEqual(2);
    expect(filterOffers(offers, { bankId: "sampath" })).toHaveLength(113);
    expect(filterOffers(offers, { cardId: "sampath-premium-credit-cards" })).toHaveLength(9);
    expect(commercialDiningOfferIds).toEqual([
      "commercial-bank-blue-orbit-citrus-june-2026",
      "commercial-bank-ceylon-curry-club-june-2026",
      "commercial-bank-cinnamon-red-june-2026",
      "commercial-bank-courtyard-marriott-june-2026",
      "commercial-bank-doubletree-weerawila-june-2026",
      "commercial-bank-favourite-restaurants-nov-2026",
      "commercial-bank-galle-face-hotel-june-2026",
      "commercial-bank-hilton-colombo-june-2026",
      "commercial-bank-hilton-residences-june-2026",
      "commercial-bank-jetwing-hotels-june-2026",
      "commercial-bank-nh-collection-june-2026",
      "commercial-bank-platinum-debit-blue-orbit-citrus-june-2026",
      "commercial-bank-premium-blue-orbit-citrus-june-2026",
      "commercial-bank-premium-ceylon-curry-club-june-2026",
      "commercial-bank-premium-cinnamon-red-june-2026",
      "commercial-bank-premium-doubletree-weerawila-june-2026",
      "commercial-bank-premium-galle-face-hotel-june-2026",
      "commercial-bank-premium-hilton-colombo-june-2026",
      "commercial-bank-premium-hilton-residences-june-2026",
      "commercial-bank-premium-jetwing-hotels-june-2026",
      "commercial-bank-premium-nh-collection-june-2026",
      "commercial-bank-premium-ramada-june-2026",
      "commercial-bank-ramada-june-2026",
      "commercial-bank-softlogic-restaurants-june-2026",
      "commercial-bank-visa-thursday-dining-july-2026"
    ]);
    expect(filterOffers(offers, { cardId: "ndb-credit-cards" })).toHaveLength(89);
    expect(filterOffers(offers, { cardId: "ndb-premium-credit-cards" })).toHaveLength(9);
    expect(filterOffers(offers, { cardId: "commercial-bank-premium-credit-cards" }).map((offer) => offer.id).sort()).toEqual([
      "commercial-bank-premium-blue-orbit-citrus-june-2026",
      "commercial-bank-premium-ceylon-curry-club-june-2026",
      "commercial-bank-premium-china-duty-free-june-2026",
      "commercial-bank-premium-cinnamon-red-june-2026",
      "commercial-bank-premium-doubletree-weerawila-june-2026",
      "commercial-bank-premium-galle-face-hotel-june-2026",
      "commercial-bank-premium-hilton-colombo-june-2026",
      "commercial-bank-premium-hilton-residences-june-2026",
      "commercial-bank-premium-jetwing-hotels-june-2026",
      "commercial-bank-premium-keells-june-2026",
      "commercial-bank-premium-minor-hotels-june-2026",
      "commercial-bank-premium-nh-collection-june-2026",
      "commercial-bank-premium-ramada-june-2026",
      "commercial-bank-premium-softlogic-glomark-june-2026"
    ]);
    expect(filterOffers(offers, { cardId: "commercial-bank-platinum-debit-cards" }).map((offer) => offer.id)).toEqual([
      "commercial-bank-platinum-debit-blue-orbit-citrus-june-2026"
    ]);
  });

  it("surfaces the full People's Bank June 10 scrape without keeping the older hand-written duplicates", async () => {
    const offers = await getActiveOffers();
    const peoplesBankOffers = offers.filter((offer) => offer.bankId === "peoples-bank");

    expect(peoplesBankOffers).toHaveLength(190);
    expect(filterOffers(offers, { cardId: "peoples-bank-credit-cards" })).toHaveLength(190);
    expect(peoplesBankOffers.map((offer) => offer.id)).not.toContain("peoples-bank-installments-december-2026");
    expect(peoplesBankOffers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "peoples-bank-keells-june-2026",
          category: "supermarket",
          merchant: "Keells"
        }),
        expect.objectContaining({
          id: "peoples-bank-plates-june-2026",
          category: "dining",
          merchant: "Plates at Cinnamon Grand Colombo"
        }),
        expect.objectContaining({
          id: "peoples-bank-travel-installments-june-2026",
          category: "installment",
          merchant: "Travel"
        })
      ])
    );
  });

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

  it("surfaces the active NTB June 10 scrape with private-banking offers on the right card", async () => {
    const offers = await getActiveOffers();
    const ntbOffers = offers.filter((offer) => offer.bankId === "ntb");

    expect(ntbOffers).toHaveLength(143);
    expect(filterOffers(offers, { cardId: "ntb-private-banking-mastercard-credit-cards" })).toHaveLength(10);
    expect(filterOffers(offers, { cardId: "ntb-mastercard-credit-cards" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ntb-butlers-june-2026",
          merchant: "Butlers"
        }),
        expect.objectContaining({
          id: "ntb-cargills-online-july-2026",
          merchant: "Cargills Online"
        }),
        expect.objectContaining({
          id: "ntb-installments-june-2026",
          category: "installment"
        })
      ])
    );
  });

  it("surfaces the full Standard Chartered June 11 scrape as active offers", async () => {
    const offers = await getActiveOffers();
    const standardCharteredOffers = offers.filter((offer) => offer.bankId === "standard-chartered");

    expect(standardCharteredOffers).toHaveLength(26);
    expect(filterOffers(offers, { cardId: "standard-chartered-credit-cards" })).toHaveLength(26);
    expect(standardCharteredOffers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "standard-chartered-aarawild-kandalama-june-2026",
          category: "travel",
          merchant: "Aarawild Kandalama"
        }),
        expect.objectContaining({
          id: "standard-chartered-aq2o-june-2026",
          category: "installment",
          merchant: "AQ2O"
        }),
        expect.objectContaining({
          id: "standard-chartered-pearl-bay-june-2026",
          category: "other",
          merchant: "Pearl Bay"
        }),
        expect.objectContaining({
          id: "standard-chartered-crazy-jets-june-2026",
          category: "travel",
          merchant: "Crazy Jets"
        })
      ])
    );
  });

  it("surfaces the full BOC June 11 scrape as active offers", async () => {
    const offers = await getActiveOffers();
    const bocOffers = offers.filter((offer) => offer.bankId === "boc");

    expect(bocOffers).toHaveLength(73);
    expect(filterOffers(offers, { cardId: "boc-credit-cards" })).toHaveLength(73);
    expect(bocOffers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "boc-keells-june-2026",
          category: "supermarket",
          merchant: "Keells"
        }),
        expect.objectContaining({
          id: "boc-air-tickets-august-2026",
          category: "installment",
          merchant: "Air Tickets"
        }),
        expect.objectContaining({
          id: "boc-crazy-jets-june-2026",
          category: "travel",
          merchant: "Crazy Jets"
        }),
        expect.objectContaining({
          id: "boc-thursdays-taste-better-with-boc-visa-cards-july-2026",
          category: "dining",
          merchant: "Thursdays Taste Better with BOC Visa Cards"
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
