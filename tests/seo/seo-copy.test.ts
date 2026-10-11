import { describe, expect, it } from "vitest";
import { buildFaqItems, buildFaqJsonLd, topBanksByOfferCount } from "@/lib/faq";
import type { Bank, Offer } from "@/lib/offers/types";
import {
  buildBankCopy,
  buildBankIntro,
  buildCategoryCopy,
  buildMerchantCopy,
  buildSiteDescription,
  latestCheckedAt,
  pluralise,
} from "@/lib/seo-copy";

const banks = [
  { id: "a", name: "Alpha Bank", shortName: "Alpha" },
  { id: "b", name: "Beta Bank", shortName: "Beta" },
] as Bank[];
const offers = [{ bankId: "b" }, { bankId: "b" }, { bankId: "a" }] as Offer[];

describe("seo copy", () => {
  it("pluralises counts", () => {
    expect(pluralise(1, "deal")).toBe("1 deal");
    expect(pluralise(2, "deal")).toBe("2 deals");
  });

  it("uses the real bank count in the site description", () => {
    expect(buildSiteDescription(13)).toContain("from 13 Sri Lankan banks");
  });

  it("picks the latest lastCheckedAt", () => {
    expect(latestCheckedAt([{ lastCheckedAt: "2026-01-02" }, {}, { lastCheckedAt: "2026-03-04" }])).toBe("2026-03-04");
    expect(latestCheckedAt([{}])).toBeUndefined();
  });

  it("builds bank copy and avoids 0 live deals", () => {
    const copy = buildBankCopy("HNB", 1, "2026-03-04T00:00:00Z");
    expect(copy.title).toBe("HNB Card Offers – 1 live deal");
    expect(copy.description).toMatch(/^1 live HNB credit and debit card offer, last checked /);
    expect(buildBankCopy("HNB", 0).title).toBe("HNB Card Offers");
    expect(buildBankCopy("HNB", 0).description).not.toMatch(/\b0 live/);
  });

  it("builds the bank intro line", () => {
    expect(buildBankIntro(5, ["dining", "fuel", "other"])).toBe("5 offers, mostly Dining and Fuel.");
    expect(buildBankIntro(1, ["dining"])).toBe("1 offer, mostly Dining.");
    expect(buildBankIntro(5, ["other", "fuel"])).toBe("5 offers, mostly Fuel.");
    expect(buildBankIntro(0, [])).toBe("No live offers right now.");
  });

  it("builds category copy", () => {
    const copy = buildCategoryCopy("Dining", 12, 1);
    expect(copy.title).toBe("Dining Card Offers in Sri Lanka – 12 deals");
    expect(copy.description).toBe("Compare 12 dining card offers from 1 Sri Lankan bank.");
    expect(buildCategoryCopy("Dining", 0, 0).title).toBe("Dining Card Offers in Sri Lanka");
  });

  it("builds merchant copy with singular forms", () => {
    expect(buildMerchantCopy("Keells", 1, 1, "1 live offer").title).toBe("Keells Card Offers – 1 deal from 1 bank");
    expect(buildMerchantCopy("Keells", 8, 3, "8 live offers").title).toBe("Keells Card Offers – 8 deals from 3 banks");
  });
});

describe("faq", () => {
  it("ranks banks by live offer count", () => {
    expect(topBanksByOfferCount(banks, offers)).toEqual(["Beta Bank (2 offers)", "Alpha Bank (1 offer)"]);
  });

  it("lists every bank and mirrors the answers into FAQPage JSON-LD", () => {
    const items = buildFaqItems(banks, offers);
    expect(items.find((item) => item.question.startsWith("Which banks do you cover"))?.answer).toContain(
      "2 Sri Lankan banks: Alpha Bank, Beta Bank",
    );
    const jsonLd = buildFaqJsonLd(items) as { "@type": string; mainEntity: { acceptedAnswer: { text: string } }[] };
    expect(jsonLd["@type"]).toBe("FAQPage");
    expect(jsonLd.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(items.map((item) => item.answer));
  });
});
