import { describe, expect, it } from "vitest";
import { feedMappers } from "@/lib/ingest/feedMappers";
import { bankRegistry } from "@/lib/sources/bankRegistry";

const reviewDateIso = "2026-07-16";

const entry = bankRegistry.find((b) => b.bankId === "hnb");
if (!entry) throw new Error("hnb entry not found in bankRegistry");

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
    expect(offer?.category).toBe("installment");
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
