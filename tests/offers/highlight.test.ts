import { describe, expect, it } from "vitest";
import {
  formatCardEligibility,
  formatLkr,
  formatValidDays,
  getOfferHighlight
} from "@/lib/offers/highlight";
import type { Offer } from "@/lib/offers/types";

const offer = (overrides: Partial<Offer>): Offer =>
  ({
    id: "id",
    bankId: "hnb",
    bankName: "HNB",
    title: "Offer",
    category: "dining",
    description: "",
    sourceUrl: "https://example.lk",
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-01T00:00:00.000Z",
    lastCheckedAt: "2026-01-01T00:00:00.000Z",
    status: "active",
    rawSourceHash: "hash",
    ...overrides
  }) as Offer;

describe("getOfferHighlight", () => {
  it("leads with the discount when there is one", () => {
    expect(getOfferHighlight(offer({ discountPct: 25 }))).toEqual({
      value: "25%",
      label: "off",
      isDiscount: true
    });
  });

  it("keeps whole percentages whole and fractions to one decimal", () => {
    expect(getOfferHighlight(offer({ discountPct: 25 })).value).toBe("25%");
    expect(getOfferHighlight(offer({ discountPct: 12.5 })).value).toBe("12.5%");
  });

  // A third of the catalog is instalment plans with no percentage at all. The term IS the offer,
  // so leading with it beats a bare "0%" or an empty badge.
  it("leads an instalment plan with its term", () => {
    const highlight = getOfferHighlight(offer({ offerType: "installment", installmentMonths: 36 }));
    expect(highlight).toEqual({ value: "36", label: "months 0%", isDiscount: false });
  });

  it("prefers a real discount over an instalment term when the offer has both", () => {
    const highlight = getOfferHighlight(
      offer({ discountPct: 20, offerType: "installment", installmentMonths: 12 })
    );
    expect(highlight.value).toBe("20%");
  });

  it("falls back to the bank's own wording when a percentage cannot express the deal", () => {
    expect(getOfferHighlight(offer({ offerType: "bogo", discountLabel: "Buy 1 Get 1 Free" }))).toEqual({
      label: "Buy 1 Get 1 Free",
      isDiscount: false
    });
  });

  // Every offer gets a headline — an empty badge reads as a broken card, not as a modest offer.
  it("always produces a label, even with nothing extracted", () => {
    expect(getOfferHighlight(offer({})).label).toBe("Special offer");
    expect(getOfferHighlight(offer({ offerType: "cashback" })).label).toBe("Cashback");
    expect(getOfferHighlight(offer({ offerType: "installment" })).label).toBe("Instalment plan");
  });

  it("ignores a blank label rather than rendering empty space", () => {
    expect(getOfferHighlight(offer({ discountLabel: "   " })).label).toBe("Special offer");
  });
});

describe("formatValidDays", () => {
  it("collapses a consecutive run into a range", () => {
    expect(formatValidDays(["mon", "tue", "wed", "thu", "fri"])).toBe("Mon–Fri");
  });

  it("lists scattered days individually, in week order", () => {
    expect(formatValidDays(["sat", "mon"])).toBe("Mon, Sat");
    expect(formatValidDays(["fri", "sat"])).toBe("Fri, Sat");
  });

  it("says nothing when the offer is not day-restricted", () => {
    expect(formatValidDays(undefined)).toBeUndefined();
    expect(formatValidDays([])).toBeUndefined();
  });
});

describe("formatCardEligibility", () => {
  it("reads as one phrase across type, network and tier", () => {
    expect(
      formatCardEligibility(offer({ cardTypes: ["credit"], cardNetworks: ["visa"], cardTiers: ["infinite"] }))
    ).toBe("Credit · Visa · Infinite");
  });

  it("keeps network names as people write them", () => {
    expect(formatCardEligibility(offer({ cardNetworks: ["amex", "jcb", "unionpay"] }))).toBe(
      "Amex · JCB · UnionPay"
    );
  });

  it("says nothing when the offer names no card, so the UI can say 'All cards'", () => {
    expect(formatCardEligibility(offer({}))).toBeUndefined();
  });
});

describe("formatLkr", () => {
  it("groups thousands", () => {
    expect(formatLkr(5000)).toBe("Rs. 5,000");
    expect(formatLkr(1250)).toBe("Rs. 1,250");
  });
});
