import { describe, expect, it } from "vitest";
import {
  enrichOffer,
  inferOfferType,
  parseCardEligibility,
  parseDiscountPct,
  parseMaxDiscountAmount,
  parseMinSpend,
  parseValidDays
} from "@/lib/ingest/enrich";
import type { ScannedOffer } from "@/lib/offers/types";

const baseOffer = (overrides: Partial<ScannedOffer> = {}): ScannedOffer => ({
  id: "test-bank-blue-orbit",
  bankId: "test-bank",
  cardId: "test-bank-credit-cards",
  title: "25% off at Blue Orbit",
  category: "dining",
  description: "Enjoy 25% off for Visa credit cardholders on Fridays. Minimum spend of Rs. 5,000.",
  termsLink: "https://example.com/offer",
  sourceUrl: "https://example.com/offer",
  lastReviewedAt: "2026-08-01T00:00:00.000Z",
  status: "active",
  ...overrides
});

describe("parseDiscountPct", () => {
  it("reads the common discount phrasings", () => {
    expect(parseDiscountPct("25% off at Blue Orbit")).toBe(25);
    expect(parseDiscountPct("Up to 30% at Odel")).toBe(30);
    expect(parseDiscountPct("Save 15% on your bill")).toBe(15);
    expect(parseDiscountPct("Flat 20% discount")).toBe(20);
    expect(parseDiscountPct("Discounts up to 40%")).toBe(40);
  });

  it("returns the largest percentage when several appear", () => {
    expect(parseDiscountPct("10% off on weekdays and 45% off on Tuesdays")).toBe(45);
  });

  it("never treats 0% as a discount", () => {
    expect(parseDiscountPct("0% interest instalment plans")).toBeUndefined();
    expect(parseDiscountPct("0% easy payment plans up to 36 months")).toBeUndefined();
  });

  it("ignores percentages that are financing rates rather than discounts", () => {
    expect(parseDiscountPct("Interest at 1.5% p.a. on your outstanding balance")).toBeUndefined();
    expect(parseDiscountPct("12 months 0% installment plans")).toBeUndefined();
  });

  // Monthly financing fees are quoted in the same shape as a discount; verbatim catalog strings.
  it("ignores a monthly financing fee", () => {
    expect(parseDiscountPct("Equal Monthly Installment Plans for a fee of 1.2% p.m.")).toBeUndefined();
    expect(parseDiscountPct("Monthly fee of 1.2% per month of original transaction value")).toBeUndefined();
    expect(parseDiscountPct("Interest at 18% per annum")).toBeUndefined();
  });

  // The financing guard keys off the words right after the percentage, so it must not swallow an
  // ordinary discount that happens to start with the same letters.
  it("still reads a discount whose following word merely starts like a rate", () => {
    expect(parseDiscountPct("Get 25% paid back on dining")).toBe(25);
  });

  it("ignores percentages outside the 1-100 range", () => {
    expect(parseDiscountPct("150% more rewards")).toBeUndefined();
  });

  it("returns undefined when the text carries no percentage", () => {
    expect(parseDiscountPct("Buy one get one free at Burger King")).toBeUndefined();
  });

  it("keeps the discount when the same text also advertises a 0% installment plan", () => {
    const text = "Up to 30% off on selected Jewellery + Up to 12 months 0% installment at Aminra Jewellers";

    expect(parseDiscountPct(text)).toBe(30);
  });
});

describe("inferOfferType", () => {
  it("classifies installments ahead of the discount they are bundled with", () => {
    const text = "Up to 30% off on selected Jewellery + Up to 12 months 0% installment at Aminra Jewellers";

    expect(inferOfferType(text, 30)).toBe("installment");
  });

  it("matches both installment spellings and easy payment wording", () => {
    expect(inferOfferType("0% interest instalment plans", undefined)).toBe("installment");
    expect(inferOfferType("Easy payment plan for 24 months", undefined)).toBe("installment");
  });

  it("classifies cashback and bogo offers", () => {
    expect(inferOfferType("Get 10% cash back on fuel", undefined)).toBe("cashback");
    expect(inferOfferType("Buy 1 Get 1 free on movie tickets", undefined)).toBe("bogo");
  });

  it("classifies anything with a parsed percentage or discount wording as a discount", () => {
    expect(inferOfferType("25% at Blue Orbit", 25)).toBe("discount");
    expect(inferOfferType("Special savings at Odel: 25% off", undefined)).toBe("discount");
  });

  it("falls back to other when nothing identifies the offer", () => {
    expect(inferOfferType("Complimentary airport lounge access", undefined)).toBe("other");
  });
});

describe("parseValidDays", () => {
  it("reads a day range in week order", () => {
    expect(parseValidDays("25% OFF (Monday to Friday)")).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(parseValidDays("Valid Mon-Fri")).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(parseValidDays("Valid Mon – Fri")).toEqual(["mon", "tue", "wed", "thu", "fri"]);
  });

  it("wraps a range across the end of the week", () => {
    expect(parseValidDays("Valid Saturday to Monday")).toEqual(["mon", "sat", "sun"]);
  });

  it("reads named days, including plurals", () => {
    expect(parseValidDays("15% off every Saturday")).toEqual(["sat"]);
    expect(parseValidDays("Available on Fridays and Saturdays")).toEqual(["fri", "sat"]);
  });

  it("dedupes repeated days and returns them in mon-to-sun order", () => {
    expect(parseValidDays("Sundays and Fridays, plus every Friday in July")).toEqual(["fri", "sun"]);
  });

  // Copy routinely pairs the generic word with the precise range it means, and that range is the
  // authority — this hotel offer excludes the Friday that "weekday" would otherwise add.
  it("lets explicit days override a generic weekday or weekend word", () => {
    expect(parseValidDays("Weekday Discount: 50% OFF for weekday stays (Sun-Thu)")).toEqual([
      "mon",
      "tue",
      "wed",
      "thu",
      "sun"
    ]);
    expect(parseValidDays("Weekend brunch, every Saturday")).toEqual(["sat"]);
  });

  // Seven days is not a restriction, and the schema cannot tell "runs every day" from "filtered to
  // all seven" — so an absent field is the honest answer.
  it("returns undefined rather than all seven days", () => {
    expect(parseValidDays("Valid Monday to Sunday")).toBeUndefined();
    expect(parseValidDays("Open weekdays and weekends")).toBeUndefined();
  });

  it("expands weekends and weekdays", () => {
    expect(parseValidDays("Valid on weekends")).toEqual(["sat", "sun"]);
    expect(parseValidDays("Weekdays only")).toEqual(["mon", "tue", "wed", "thu", "fri"]);
  });

  it("returns undefined when the offer runs every day", () => {
    expect(parseValidDays("Valid everyday at all outlets")).toBeUndefined();
    expect(parseValidDays("Valid on all days")).toBeUndefined();
  });

  it("does not match day names embedded in other words", () => {
    expect(parseValidDays("20% off sunglasses")).toBeUndefined();
    expect(parseValidDays("Satisfaction guaranteed")).toBeUndefined();
  });

  it("returns undefined when there is no day signal at all", () => {
    expect(parseValidDays("25% off at Blue Orbit")).toBeUndefined();
  });
});

describe("parseMinSpend", () => {
  it("reads minimum spend phrasings", () => {
    expect(parseMinSpend("Minimum spend of Rs. 5,000")).toBe(5000);
    expect(parseMinSpend("Min. spend LKR 4,000 per transaction")).toBe(4000);
    expect(parseMinSpend("Min Rs.4,000")).toBe(4000);
    expect(parseMinSpend("Applicable on a minimum bill of LKR 7,500")).toBe(7500);
    expect(parseMinSpend("Spend Rs 10,000 or more to qualify")).toBe(10000);
  });

  it("returns undefined when no rupee threshold is stated", () => {
    expect(parseMinSpend("Minimum 12 months tenure")).toBeUndefined();
    expect(parseMinSpend("25% off at Blue Orbit")).toBeUndefined();
  });
});

describe("parseMaxDiscountAmount", () => {
  it("reads discount cap phrasings", () => {
    expect(parseMaxDiscountAmount("Maximum discount of Rs. 1,250")).toBe(1250);
    expect(parseMaxDiscountAmount("Max saving LKR 2,000 per card")).toBe(2000);
    expect(parseMaxDiscountAmount("Discount capped at Rs 3,000")).toBe(3000);
    expect(parseMaxDiscountAmount("15% off up to a maximum of Rs. 5,000")).toBe(5000);
  });

  it("returns undefined when no cap is stated", () => {
    expect(parseMaxDiscountAmount("15% off with no upper limit")).toBeUndefined();
  });

  // A bare "maximum" is usually a transaction ceiling, not a cap on the saving. Publishing one as
  // the cap told cardholders a Rs. 1 Million spend limit was a Rs. 1 discount cap.
  it("ignores a maximum that caps the transaction rather than the saving", () => {
    expect(parseMaxDiscountAmount("Minimum transaction Rs. 10,000 and maximum Rs. 1 Million")).toBeUndefined();
    expect(parseMaxDiscountAmount("Maximum bill value Rs. 50,000")).toBeUndefined();
  });

  it("scales a cap written with a magnitude word", () => {
    expect(parseMaxDiscountAmount("Maximum saving of Rs. 1 Million")).toBe(1_000_000);
    expect(parseMaxDiscountAmount("Maximum discount Rs. 2.5 Mn")).toBe(2_500_000);
  });
});

describe("parseCardEligibility", () => {
  it("reads networks and card kinds in const order", () => {
    const result = parseCardEligibility("15% off for all Sampath Mastercard & Visa Credit Cardholders");

    expect(result.cardNetworks).toEqual(["visa", "mastercard"]);
    expect(result.cardTypes).toEqual(["credit"]);
    expect(result.cardTiers).toBeUndefined();
  });

  it("reads tiers in const order", () => {
    const result = parseCardEligibility("Exclusively for Visa Infinite and Signature credit cards");

    expect(result.cardTiers).toEqual(["signature", "infinite"]);
  });

  it("tags every card kind named in card context", () => {
    expect(parseCardEligibility("Valid for credit and debit cardholders").cardTypes).toEqual(["credit", "debit"]);
    expect(parseCardEligibility("Prepaid cards only").cardTypes).toEqual(["prepaid"]);
  });

  it("reads the remaining networks", () => {
    expect(parseCardEligibility("American Express cardholders").cardNetworks).toEqual(["amex"]);
    expect(parseCardEligibility("Valid on UnionPay and JCB cards").cardNetworks).toEqual(["unionpay", "jcb"]);
    expect(parseCardEligibility("Diners Club members").cardNetworks).toEqual(["diners"]);
  });

  it("does not read a card kind out of prose that never mentions a card", () => {
    expect(parseCardEligibility("Credit is given where credit is due").cardTypes).toBeUndefined();
  });

  it("does not treat marketing copy as a premium tier", () => {
    expect(parseCardEligibility("Premium offers for the season").cardTiers).toBeUndefined();
    expect(parseCardEligibility("For premium cardholders").cardTiers).toEqual(["premium"]);
  });

  // "Premium" reaches a card noun in ordinary copy far too easily, so unlike the other tiers it
  // only counts when it directly qualifies the card. Both strings are verbatim from the catalog.
  it("does not read a premium tier from copy that merely mentions a card nearby", () => {
    expect(
      parseCardEligibility("0% instalment plans on Life & General Insurance premium payments with Seylan Credit Card")
        .cardTiers
    ).toBeUndefined();
    expect(
      parseCardEligibility("Up to 50% discount on premium medical care abroad for ComBank Visa Credit and Debit Cardholders")
        .cardTiers
    ).toBeUndefined();
  });

  // Every tier word also has an ordinary-English sense; these strings are taken verbatim from
  // data/scanned-offers.json, where a bare word match tagged each of them with a card tier.
  it("does not read a tier out of ordinary prose that happens to use the word", () => {
    expect(parseCardEligibility("30% off Labour Charge for 22K Yellow Gold Jewelleries").cardTiers).toBeUndefined();
    expect(parseCardEligibility("50% Savings on Gold Jewellery Labour Charges").cardTiers).toBeUndefined();
    expect(parseCardEligibility("Up to 40% off on a selected range of world-renowned brands").cardTiers).toBeUndefined();
    expect(parseCardEligibility("20% Savings on LOTTE WORLD AQUARIUM Tickets").cardTiers).toBeUndefined();
    expect(parseCardEligibility("Enjoy a status match to Platinum tier at 850+ hotels").cardTiers).toBeUndefined();
  });

  // Banks enumerate eligible tiers before naming the card once, so the card noun can sit well past
  // the tier that needs it.
  it("reads every tier in an enumeration that ends in a single card noun", () => {
    expect(
      parseCardEligibility("0% instalment plans for Platinum, Signature and Infinite credit cardholders").cardTiers
    ).toEqual(["platinum", "signature", "infinite"]);
    expect(
      parseCardEligibility("Valid for Seylan Visa Gold, Platinum, Mastercard Titanium Credit & Debit Cards").cardTiers
    ).toEqual(["gold", "platinum"]);
  });

  it("reads a tier from the American Express cardmember phrasing", () => {
    expect(
      parseCardEligibility("Sampath Bank American Express Platinum Ultramiles Credit Cardmembers").cardTiers
    ).toEqual(["platinum"]);
  });

  it("omits every key when nothing matches", () => {
    expect(parseCardEligibility("20% off at Blue Orbit")).toEqual({});
  });
});

describe("enrichOffer", () => {
  it("fills the fields the offer is missing", () => {
    const enriched = enrichOffer(baseOffer());

    expect(enriched).toMatchObject({
      offerType: "discount",
      discountPct: 25,
      minSpend: 5000,
      validDays: ["fri"],
      cardNetworks: ["visa"],
      cardTypes: ["credit"]
    });
  });

  it("never overwrites values the extractor or a feed mapper already supplied", () => {
    const preset = baseOffer({
      offerType: "cashback",
      discountPct: 5,
      minSpend: 100,
      maxDiscountAmount: 250,
      validDays: ["mon"],
      cardNetworks: ["amex"],
      cardTypes: ["debit"],
      cardTiers: ["platinum"]
    });

    expect(enrichOffer(preset)).toMatchObject({
      offerType: "cashback",
      discountPct: 5,
      minSpend: 100,
      maxDiscountAmount: 250,
      validDays: ["mon"],
      cardNetworks: ["amex"],
      cardTypes: ["debit"],
      cardTiers: ["platinum"]
    });
  });

  it("leaves unparsed fields absent instead of writing undefined keys", () => {
    const enriched = enrichOffer(
      baseOffer({
        title: "Complimentary dessert at Blue Orbit",
        description: "Complimentary dessert with every main course."
      })
    );

    expect(Object.keys(enriched)).not.toContain("maxDiscountAmount");
    expect(Object.keys(enriched)).not.toContain("validDays");
    expect(JSON.parse(JSON.stringify(enriched))).not.toHaveProperty("discountPct");
  });

  it("classifies an installment offer that also quotes a discount", () => {
    const enriched = enrichOffer(
      baseOffer({
        title: "Up to 30% off on selected Jewellery",
        description: "Up to 12 months 0% installment at Aminra Jewellers"
      })
    );

    expect(enriched.discountPct).toBe(30);
    expect(enriched.offerType).toBe("installment");
  });

  it("does not mutate the offer it was given", () => {
    const offer = baseOffer();
    const snapshot = JSON.parse(JSON.stringify(offer));

    enrichOffer(offer);

    expect(offer).toEqual(snapshot);
  });

  it("preserves the fields it does not enrich", () => {
    const enriched = enrichOffer(baseOffer());

    expect(enriched).toMatchObject({
      id: "test-bank-blue-orbit",
      bankId: "test-bank",
      cardId: "test-bank-credit-cards",
      category: "dining",
      status: "active"
    });
  });
});
