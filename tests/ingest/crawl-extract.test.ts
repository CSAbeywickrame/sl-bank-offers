import { describe, expect, it, vi } from "vitest";
import { refreshCrawlBank, groupOffersBySourceUrl, type CrawlExtractDeps } from "@/lib/ingest/crawlExtract";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";
import type { ScannedOffer } from "@/lib/offers/types";

const entry = {
  bankId: "peoples-bank",
  enabled: true,
  bank: { id: "peoples-bank", name: "People's Bank", shortName: "People's Bank", websiteUrl: "https://www.peoplesbank.lk" },
  cards: [{ id: "peoples-bank-credit-cards", bankId: "peoples-bank", name: "People's Bank Credit Cards" }],
  defaultCardId: "peoples-bank-credit-cards",
  sources: [],
} as unknown as BankRegistryEntry;

const reviewDate = "2026-06-19T00:00:00.000Z";
const URL_A = "https://www.peoplesbank.lk/promotion/keells-25-off-credit/";

function offerFor(url: string, id = "peoples-bank-aaa"): ScannedOffer {
  return {
    id, bankId: "peoples-bank", cardId: "peoples-bank-credit-cards",
    title: "25% off at Keells", category: "supermarket", description: "old",
    termsLink: url, sourceUrl: url, lastReviewedAt: "2026-06-10T00:00:00.000Z", status: "active",
  };
}

function makeExtract() {
  return vi.fn(async (sourceUrl: string) => ({
    offers: [{ ...offerFor(sourceUrl), description: "fresh-from-detail" }],
    inputTokens: 100, outputTokens: 20,
  }));
}

describe("groupOffersBySourceUrl", () => {
  it("keys by normalized sourceUrl", () => {
    const map = groupOffersBySourceUrl([offerFor("https://www.peoplesbank.lk/promotion/keells-25-off-credit#x")]);
    expect(map.has(URL_A)).toBe(true);
  });
});

describe("refreshCrawlBank", () => {
  const baseDeps = (over: Partial<CrawlExtractDeps> = {}): CrawlExtractDeps => ({
    discover: async () => ({ ok: true, urls: [URL_A] }),
    fetchDetail: async () => ({ ok: true, strippedText: "Keells 25% off Validity ...", contentHash: "h1" }),
    extract: makeExtract(),
    throttleMs: 0,
    ...over,
  });

  it("extracts a new detail page and sets the deep link as sourceUrl", async () => {
    const deps = baseDeps();
    const res = await refreshCrawlBank(entry, [], {}, reviewDate, deps);
    expect(res.ok).toBe(true);
    expect(res.extracted).toBe(1);
    expect(res.offers[0]?.sourceUrl).toBe(URL_A);
    expect(res.offers[0]?.description).toBe("fresh-from-detail");
    expect(res.detailHashes[URL_A]).toBe("h1");
  });

  it("reuses the stored offer when the hash is unchanged (zero extract calls)", async () => {
    const extract = makeExtract();
    const res = await refreshCrawlBank(entry, [offerFor(URL_A)], { [URL_A]: "h1" }, reviewDate, baseDeps({ extract }));
    expect(extract).not.toHaveBeenCalled();
    expect(res.reused).toBe(1);
    expect(res.offers[0]?.description).toBe("old");
    expect(res.offers[0]?.lastReviewedAt).toBe(reviewDate);
  });

  it("re-extracts when the hash changed", async () => {
    const extract = makeExtract();
    const res = await refreshCrawlBank(entry, [offerFor(URL_A)], { [URL_A]: "OLD" }, reviewDate, baseDeps({ extract }));
    expect(extract).toHaveBeenCalledTimes(1);
    expect(res.offers[0]?.description).toBe("fresh-from-detail");
  });

  it("returns ok:false with no extract calls when discovery fails", async () => {
    const extract = makeExtract();
    const res = await refreshCrawlBank(entry, [], {}, reviewDate, baseDeps({ extract, discover: async () => ({ ok: false, error: "boom" }) }));
    expect(res.ok).toBe(false);
    expect(extract).not.toHaveBeenCalled();
  });

  it("keeps the stored offer when a detail fetch fails", async () => {
    const extract = makeExtract();
    const res = await refreshCrawlBank(entry, [offerFor(URL_A)], { [URL_A]: "h1" }, reviewDate, baseDeps({
      extract, fetchDetail: async () => ({ ok: false, error: "404" }),
    }));
    expect(extract).not.toHaveBeenCalled();
    expect(res.offers).toHaveLength(1);
    expect(res.reused).toBe(1);
  });

  it("respects maxExtractions, deferring the rest", async () => {
    const urls = [URL_A, "https://www.peoplesbank.lk/promotion/cargills-25-off-credit/"];
    const extract = makeExtract();
    const res = await refreshCrawlBank(entry, [], {}, reviewDate, baseDeps({
      extract, discover: async () => ({ ok: true, urls }), maxExtractions: 1,
    }));
    expect(extract).toHaveBeenCalledTimes(1);
    expect(res.extracted).toBe(1);
  });
});
