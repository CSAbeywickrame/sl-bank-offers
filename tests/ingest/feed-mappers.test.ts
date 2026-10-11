import { describe, expect, it } from "vitest";
import { FEED_MAPPER_VERSION, feedMappers } from "@/lib/ingest/feedMappers";
import { bankRegistry } from "@/lib/sources/bankRegistry";

const reviewDateIso = "2026-07-16";

const entry = bankRegistry.find((b) => b.bankId === "hnb");
if (!entry) throw new Error("hnb entry not found in bankRegistry");

const sampathEntry = bankRegistry.find((b) => b.bankId === "sampath");
if (!sampathEntry) throw new Error("sampath entry not found in bankRegistry");

describe("feedMappers.hnb", () => {

  const fixture = {
    page: 1,
    limit: 1000,
    total: 7,
    totalPages: 1,
    data: [
      {
        id: 3692,
        title: "Up to 30% off on selected Jewellery + Up to 12 months 0% installment at Aminra Jewellers",
        thumb: "merchants/aminra-jewellers.jpg",
        merchant: "Aminra Jewellers",
        cardType: "credit",
        to: "2026-08-31",
        valid: "Valid Until"
      },
      {
        id: 3692,
        title: "Up to 30% off on selected Jewellery + Up to 12 months 0% installment at Aminra Jewellers.",
        thumb: "merchants/aminra-jewellers.jpg",
        merchant: "Aminra Jewellers",
        cardType: "credit",
        to: "2026-08-31",
        valid: "Valid Until"
      },
      {
        id: 4001,
        title: "Get 10% off at ABC Store",
        merchant: "ABC Store",
        cardType: "debit",
        to: "2026-09-30",
        valid: "Valid Until"
      },
      {
        id: 4002,
        title: "15% off at XYZ Restaurant",
        merchant: "XYZ Restaurant",
        cardType: "credit/debit",
        to: "2026-10-15",
        valid: "Valid Until"
      },
      {
        id: 4003,
        title: "20% off at Some Merchant",
        merchant: "Some Merchant",
        cardType: "credit",
        to: "2026-12-01",
        valid: "Valid From 2026-04-01 to "
      },
      {
        id: null,
        title: "Missing id offer",
        merchant: "Nowhere",
        cardType: "credit",
        to: "2026-11-01",
        valid: "Valid Until"
      },
      {
        id: 4004,
        title: "   ",
        merchant: "Blank Title Merchant",
        cardType: "credit",
        to: "2026-11-01",
        valid: "Valid Until"
      }
    ]
  };

  const offers = feedMappers.hnb(JSON.stringify(fixture), entry, reviewDateIso);

  it("maps rows, dedupes by id, and drops rows with missing id or empty title", () => {
    expect(offers).toHaveLength(4);
  });

  it("maps the normal credit row correctly", () => {
    const offer = offers.find((o) => o.id === "hnb-3692");
    expect(offer).toBeDefined();
    expect(offer?.sourceUrl).toBe("https://www.hnb.lk/card-promotion/search/3692");
    expect(offer?.termsLink).toBe("https://www.hnb.lk/card-promotion/search/3692");
    expect(offer?.validUntil).toBe("2026-08-31");
    // "...selected Jewellery ... 0% installment at Aminra Jewellers": the vertical is what is on
    // sale, and the instalment plan is carried by offerType instead.
    expect(offer?.category).toBe("fashion");
    expect(offer?.bankId).toBe("hnb");
    expect(offer?.status).toBe("active");
  });

  it("parses validFrom out of the 'Valid From ... to' text", () => {
    const offer = offers.find((o) => o.id === "hnb-4003");
    expect(offer?.validFrom).toBe("2026-04-01");
  });

  it("routes debit cardType to the debit card id", () => {
    const offer = offers.find((o) => o.id === "hnb-4001");
    expect(offer?.cardId).toBe("hnb-debit-cards");
  });

  it("routes credit/debit cardType to the default (credit) card id", () => {
    const offer = offers.find((o) => o.id === "hnb-4002");
    expect(offer?.cardId).toBe(entry.defaultCardId);
  });

  it("throws on an empty response", () => {
    expect(() => feedMappers.hnb("", entry, reviewDateIso)).toThrow();
  });

  it("throws on invalid JSON", () => {
    expect(() => feedMappers.hnb("not json", entry, reviewDateIso)).toThrow();
  });

  it("throws when the response has no data array", () => {
    expect(() => feedMappers.hnb(JSON.stringify({}), entry, reviewDateIso)).toThrow();
  });

  it("throws when the response is truncated relative to total", () => {
    const truncated = { page: 1, limit: 1000, total: 819, totalPages: 1, data: fixture.data.slice(0, 3) };
    expect(() => feedMappers.hnb(JSON.stringify(truncated), entry, reviewDateIso)).toThrow();
  });
});

describe("feedMappers.sampath", () => {

  // Category values arrive from the live API in mixed case (Hotels, Electronics_and_Furniture,
  // VISA_Offers, Other), so every lookup depends on the mapper normalizing case first.
  const fixture = {
    data: [
      { id: 101, company_name: "Abans", short_discount: "10% off", category: "Electronics_and_Furniture", enable: true },
      { id: 102, company_name: "Cinnamon Grand", short_discount: "20% off", category: "Hotels", enable: true },
      { id: 103, company_name: "Some Insurer", short_discount: "0% Instalment Plan for 12 months", category: "health_and_insurance", enable: true },
      { id: 104, company_name: "Test Hotel", short_discount: "15% off", category: "hotels", enable: true },
      { id: 105, company_name: "Test Market", short_discount: "5% off", category: "super_markets", enable: true },
      { id: 106, company_name: "Softlogic", short_discount: "0% Installment Plan for 24 months", category: "electronics_and_furniture", enable: true },
      { id: 201, company_name: "Test Store", short_discount: "10% off", category: "Mastercard_Offers", enable: true },
    ]
  };

  const offers = feedMappers.sampath(JSON.stringify(fixture), sampathEntry, reviewDateIso);

  const categoryOf = (id: number) => offers.find((o) => o.id === `sampath-${id}`)?.category;

  it("lowercases a mixed-case category before lookup (Electronics_and_Furniture -> electronics)", () => {
    expect(categoryOf(101)).toBe("electronics");
  });

  it("lowercases a mixed-case category before lookup (Hotels -> hotels)", () => {
    expect(categoryOf(102)).toBe("hotels");
  });

  // Payout mechanics are offerType now. An instalment plan sold by an insurer is health; one sold
  // by an electronics retailer is electronics. The plan itself is never the category.
  it("gives an instalment offer the vertical of what is being bought", () => {
    expect(categoryOf(103)).toBe("health");
    expect(categoryOf(106)).toBe("electronics");
  });

  it("still maps existing lowercase slugs correctly", () => {
    expect(categoryOf(104)).toBe("hotels");
    expect(categoryOf(105)).toBe("supermarket");
  });

  // The card-network tabs say who qualifies, not what is sold, so the vertical has to come from
  // the offer text — and falls back to "other" only when the text names nothing either.
  it("reads a vertical out of the text when the tab only names a card network", () => {
    expect(categoryOf(201)).toBe("other");
  });
});

describe("feedMappers.hnb card types and images", () => {
  const rows = [
    { id: 1, title: "10% off at A", thumb: "merchants/a-logo.jpg", merchant: "A", cardType: "credit" },
    { id: 2, title: "10% off at B", thumb: "merchants/Flawless Diamond Jewellery/Flawless.jpg", merchant: "B", cardType: " Debit " },
    { id: 3, title: "10% off at C", thumb: "", merchant: "C", cardType: "Credit/Debit" },
    { id: 4, title: "10% off at D", merchant: "D", cardType: "prepaid" },
    { id: 5, title: "10% off at E", thumb: "merchants/E%20Logo/e.jpg", merchant: "E", cardType: "debit/credit" },
    { id: 6, title: "10% off at F", thumb: "https://cdn.example.com/f.png?v=2", merchant: "F", cardType: "credit" }
  ];
  const offers = feedMappers.hnb(JSON.stringify({ total: 6, data: rows }), entry, reviewDateIso);
  const byId = (id: number) => offers.find((o) => o.id === `hnb-${id}`);

  it("maps cardType to card kinds, omitting unknown values", () => {
    expect(byId(1)?.cardTypes).toEqual(["credit"]);
    expect(byId(2)?.cardTypes).toEqual(["debit"]);
    expect(byId(3)?.cardTypes).toEqual(["credit", "debit"]);
    expect(byId(4)?.cardTypes).toBeUndefined();
  });

  it("builds the asset url, encoding each path segment", () => {
    expect(byId(1)?.imageUrl).toBe("https://assets.hnb.lk/atdi/merchants/a-logo.jpg");
    expect(byId(2)?.imageUrl).toBe("https://assets.hnb.lk/atdi/merchants/Flawless%20Diamond%20Jewellery/Flawless.jpg");
  });

  it("accepts either order for credit/debit", () => {
    expect(byId(5)?.cardTypes).toEqual(["debit", "credit"]);
  });

  it("leaves an already-encoded thumb alone and passes an absolute thumb through", () => {
    expect(byId(5)?.imageUrl).toBe("https://assets.hnb.lk/atdi/merchants/E%20Logo/e.jpg");
    expect(byId(6)?.imageUrl).toBe("https://cdn.example.com/f.png?v=2");
  });

  it("omits imageUrl when thumb is empty or missing", () => {
    expect(byId(3)?.imageUrl).toBeUndefined();
    expect(byId(4)?.imageUrl).toBeUndefined();
  });
});

describe("feedMappers.sampath headline, networks and images", () => {
  const eligible = (text: string) => [
    { title: "Partner", description: "<span>Someone</span>" },
    { title: "Eligible Card Categories", description: `<span>${text}</span>` }
  ];
  const fixture = {
    data: [
      { id: 1, company_name: "A", short_discount: "Up to 20% Discount", category: "VISA_Offers", image_url: "https://www.sampath.lk/api/uploads/blob_1", enable: true },
      { id: 2, company_name: "B", short_discount: "Special Rates", category: "Premium_Offers", enable: true },
      { id: 3, company_name: "C", short_discount: "Enjoy Rs. 500 off for Sampath Mastercard Credit &amp; Debit cardholders", category: "Mastercard_Offers", enable: true },
      { id: 4, company_name: "D", short_discount: "12 Months 0% Interest Extended Settlement Plans", category: "hotels", enable: true },
      { id: 5, company_name: "E", short_discount: "10% Discount", category: "Premium_Offers", image_url: "/relative.png", cards_new: eligible("All Sampath Visa Infinite Metal and Visa Infinite Credit Card"), enable: true },
      { id: 6, company_name: "F", short_discount: "10% Discount", category: "Mastercard_Offers", cards_new: eligible("All Sampath Visa Infinite Credit Card"), enable: true }
    ]
  };
  const offers = feedMappers.sampath(JSON.stringify(fixture), sampathEntry, reviewDateIso);
  const byId = (id: number) => offers.find((o) => o.id === `sampath-${id}`);

  it("sets discountPct and no label when the text carries a percentage", () => {
    expect(byId(1)?.discountPct).toBe(20);
    expect(byId(1)?.discountLabel).toBeUndefined();
  });

  it("keeps non-percentage text as a decoded discountLabel", () => {
    expect(byId(2)?.discountLabel).toBe("Special Rates");
    expect(byId(2)?.discountPct).toBeUndefined();
    expect(byId(3)?.discountLabel).toContain("Credit & Debit");
    expect(byId(4)?.discountPct).toBeUndefined();
    expect(byId(4)?.discountLabel).toBe("12 Months 0% Interest Extended Settlement Plans");
  });

  it("derives networks from the tab", () => {
    expect(byId(1)?.cardNetworks).toEqual(["visa"]);
    expect(byId(3)?.cardNetworks).toEqual(["mastercard"]);
    expect(byId(2)?.cardNetworks).toBeUndefined();
  });

  it("prefers the Eligible Card Categories block over the tab network, using the tab only as a fallback", () => {
    expect(byId(5)?.cardNetworks).toEqual(["visa"]);
    expect(byId(5)?.cardTypes).toEqual(["credit"]);
    expect(byId(5)?.cardTiers).toContain("infinite");
    expect(byId(6)?.cardNetworks).toEqual(["visa"]);
  });

  it("passes an absolute image_url through and resolves a relative one against sampath.lk", () => {
    expect(byId(1)?.imageUrl).toBe("https://www.sampath.lk/api/uploads/blob_1");
    expect(byId(5)?.imageUrl).toBe("https://www.sampath.lk/relative.png");
    expect(byId(2)?.imageUrl).toBeUndefined();
  });
});

describe("hnb bank registry wiring", () => {
  it("has a single feed source pointing at venus.hnb.lk", () => {
    expect(entry.sources).toHaveLength(1);
    expect(entry.sources[0].type).toBe("feed");
    expect(entry.sources[0].url).toContain("venus.hnb.lk");
  });

  it("is registered in feedMappers", () => {
    expect(Object.keys(feedMappers)).toContain("hnb");
  });
});

describe("FEED_MAPPER_VERSION", () => {
  it("is a positive integer folded into the refresh hash", () => {
    expect(Number.isInteger(FEED_MAPPER_VERSION) && FEED_MAPPER_VERSION > 0).toBe(true);
  });
});
