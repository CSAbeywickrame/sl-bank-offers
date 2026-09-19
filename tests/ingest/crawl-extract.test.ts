import { describe, expect, it, vi } from "vitest";
import {
  refreshCrawlBank,
  groupOffersBySourceUrl,
  carryForwardUnextractedOffers,
  discoverCrawlUrls,
  collectPageAssets,
  MIN_ASSET_IMAGE_BYTES,
  type CrawlExtractDeps,
  type DiscoveredCrawlUrl,
} from "@/lib/ingest/crawlExtract";
import { normalizeUrl, type CrawlRecipe } from "@/lib/ingest/crawlBank";
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

// Builds a fetchDetail fake returning static_html text content for every URL, regardless of type.
function htmlFetchDetail() {
  return vi.fn(async () => ({ ok: true, strippedText: "Keells 25% off Validity ...", contentHash: "h1" }));
}

describe("groupOffersBySourceUrl", () => {
  it("keys by normalized sourceUrl", () => {
    const map = groupOffersBySourceUrl([offerFor("https://www.peoplesbank.lk/promotion/keells-25-off-credit#x")]);
    expect(map.has(URL_A)).toBe(true);
  });

  it("keys a pdf/image sourceUrl without forcing a trailing slash", () => {
    const map = groupOffersBySourceUrl([offerFor("https://www.peoplesbank.lk/files/dining-offers.pdf")]);
    expect(map.has("https://www.peoplesbank.lk/files/dining-offers.pdf")).toBe(true);
  });
});

describe("carryForwardUnextractedOffers", () => {
  it("returns the prior offer for a url present in the map", () => {
    const map = groupOffersBySourceUrl([offerFor(URL_A)]);
    const carried = carryForwardUnextractedOffers(map, [URL_A]);
    expect(carried).toHaveLength(1);
    expect(carried[0]?.sourceUrl).toBe(URL_A);
  });

  it("returns an empty array for a url with no entry in the map", () => {
    const map = groupOffersBySourceUrl([offerFor(URL_A)]);
    const carried = carryForwardUnextractedOffers(map, ["https://www.peoplesbank.lk/promotion/nothing-here/"]);
    expect(carried).toEqual([]);
  });

  it("returns the union of offers for only the urls present in the map", () => {
    const GOOD_URL_B = "https://www.peoplesbank.lk/promotion/cargills-25-off-credit/";
    const MISSING_URL = "https://www.peoplesbank.lk/promotion/nothing-here/";
    const map = groupOffersBySourceUrl([
      offerFor(URL_A, "peoples-bank-a"),
      offerFor(GOOD_URL_B, "peoples-bank-b"),
    ]);
    const carried = carryForwardUnextractedOffers(map, [URL_A, MISSING_URL, GOOD_URL_B]);
    expect(carried.map((o) => o.id).sort()).toEqual(["peoples-bank-a", "peoples-bank-b"]);
  });

  it("matches an asset-shaped (pdf/image) url without forcing a trailing slash", () => {
    const PDF_URL = "https://www.peoplesbank.lk/files/dining-offers.pdf";
    const map = groupOffersBySourceUrl([offerFor(PDF_URL)]);
    const carried = carryForwardUnextractedOffers(map, [PDF_URL]);
    expect(carried).toHaveLength(1);
    expect(carried[0]?.sourceUrl).toBe(PDF_URL);
  });

  it("normalizes the lookup url the same way the stored offer's sourceUrl was normalized", () => {
    const map = groupOffersBySourceUrl([offerFor(URL_A)]); // stored under the normalized URL_A
    // A URL fragment must not prevent the match — mirrors groupOffersBySourceUrl's own "keys by normalized sourceUrl" test.
    const carried = carryForwardUnextractedOffers(map, [`${URL_A}#some-fragment`]);
    expect(carried).toHaveLength(1);
  });
});

describe("refreshCrawlBank", () => {
  const baseDeps = (over: Partial<CrawlExtractDeps> = {}): CrawlExtractDeps => ({
    discover: async () => ({ ok: true, urls: [{ url: URL_A, type: "static_html" }] }),
    fetchDetail: htmlFetchDetail(),
    extract: async (sourceUrl) => makeExtract()(sourceUrl),
    throttleMs: 0,
    ...over,
  });

  it("extracts a new detail page and sets the deep link as sourceUrl", async () => {
    const extract = makeExtract();
    const deps = baseDeps({ extract: (sourceUrl) => extract(sourceUrl) });
    const res = await refreshCrawlBank(entry, [], {}, reviewDate, deps);
    expect(res.ok).toBe(true);
    expect(res.extracted).toBe(1);
    expect(res.offers[0]?.sourceUrl).toBe(URL_A);
    expect(res.offers[0]?.description).toBe("fresh-from-detail");
    expect(res.detailHashes[URL_A]).toBe("h1");
  });

  it("reuses the stored offer when the hash is unchanged (zero extract calls)", async () => {
    const extract = vi.fn(makeExtract());
    const res = await refreshCrawlBank(entry, [offerFor(URL_A)], { [URL_A]: "h1" }, reviewDate, baseDeps({ extract: (sourceUrl) => extract(sourceUrl) }));
    expect(extract).not.toHaveBeenCalled();
    expect(res.reused).toBe(1);
    expect(res.offers[0]?.description).toBe("old");
    expect(res.offers[0]?.lastReviewedAt).toBe(reviewDate);
  });

  it("re-extracts when the hash changed", async () => {
    const extract = vi.fn(makeExtract());
    const res = await refreshCrawlBank(entry, [offerFor(URL_A)], { [URL_A]: "OLD" }, reviewDate, baseDeps({ extract: (sourceUrl) => extract(sourceUrl) }));
    expect(extract).toHaveBeenCalledTimes(1);
    expect(res.offers[0]?.description).toBe("fresh-from-detail");
  });

  it("returns ok:false with no extract calls when discovery fails", async () => {
    const extract = vi.fn(makeExtract());
    const res = await refreshCrawlBank(entry, [], {}, reviewDate, baseDeps({
      extract: (sourceUrl) => extract(sourceUrl), discover: async () => ({ ok: false, error: "boom" }),
    }));
    expect(res.ok).toBe(false);
    expect(extract).not.toHaveBeenCalled();
  });

  it("keeps the stored offer when a detail fetch fails", async () => {
    const extract = vi.fn(makeExtract());
    const res = await refreshCrawlBank(entry, [offerFor(URL_A)], { [URL_A]: "h1" }, reviewDate, baseDeps({
      extract: (sourceUrl) => extract(sourceUrl), fetchDetail: async () => ({ ok: false, error: "404" }),
    }));
    expect(extract).not.toHaveBeenCalled();
    expect(res.offers).toHaveLength(1);
    expect(res.reused).toBe(1);
  });

  it("respects maxExtractions, deferring the rest", async () => {
    const urls: DiscoveredCrawlUrl[] = [
      { url: URL_A, type: "static_html" },
      { url: "https://www.peoplesbank.lk/promotion/cargills-25-off-credit/", type: "static_html" },
    ];
    const extract = vi.fn(makeExtract());
    const res = await refreshCrawlBank(entry, [], {}, reviewDate, baseDeps({
      extract: (sourceUrl) => extract(sourceUrl), discover: async () => ({ ok: true, urls }), maxExtractions: 1,
    }));
    expect(extract).toHaveBeenCalledTimes(1);
    expect(res.extracted).toBe(1);
  });

  it("routes a mix of static_html/pdf/image URLs to the matching fetch+extract branch, each keeping its own sourceUrl", async () => {
    const PDF_URL = "https://www.peoplesbank.lk/files/dining-offers.pdf";
    const IMAGE_URL = "https://www.peoplesbank.lk/banners/dining-promo.jpg";
    const urls: DiscoveredCrawlUrl[] = [
      { url: URL_A, type: "static_html" },
      { url: PDF_URL, type: "pdf" },
      { url: IMAGE_URL, type: "image" },
    ];

    const fetchDetail = vi.fn(async (url: string, type: DiscoveredCrawlUrl["type"]) => {
      if (type === "static_html") return { ok: true, strippedText: "html content here", contentHash: "h-html" };
      if (type === "pdf") return { ok: true, pdfBytes: Buffer.from("pdf-bytes"), contentHash: "h-pdf" };
      return { ok: true, imageBytes: Buffer.from("image-bytes"), imageMediaType: "image/jpeg" as const, contentHash: "h-image" };
    });

    const extract = vi.fn(async (sourceUrl: string) => ({
      offers: [{ ...offerFor(sourceUrl, `peoples-bank-${sourceUrl.length}`) }],
      inputTokens: 10, outputTokens: 5,
    }));

    const res = await refreshCrawlBank(entry, [], {}, reviewDate, {
      discover: async () => ({ ok: true, urls }),
      fetchDetail,
      extract,
      throttleMs: 0,
    });

    expect(res.ok).toBe(true);
    expect(fetchDetail).toHaveBeenCalledWith(URL_A, "static_html");
    expect(fetchDetail).toHaveBeenCalledWith(PDF_URL, "pdf");
    expect(fetchDetail).toHaveBeenCalledWith(IMAGE_URL, "image");
    expect(extract).toHaveBeenCalledTimes(3);

    const sourceUrls = res.offers.map((o) => o.sourceUrl).sort();
    expect(sourceUrls).toEqual([IMAGE_URL, PDF_URL, URL_A].sort());
  });

  it("records a failed asset in assetFailures without discarding offers from sibling URLs", async () => {
    const GOOD_URL_B = "https://www.peoplesbank.lk/promotion/cargills-25-off-credit/";
    const BAD_URL = "https://www.peoplesbank.lk/promotion/broken-link/";
    const urls: DiscoveredCrawlUrl[] = [
      { url: URL_A, type: "static_html" },
      { url: GOOD_URL_B, type: "static_html" },
      { url: BAD_URL, type: "static_html" },
    ];

    const fetchDetail = vi.fn(async (url: string) =>
      url === BAD_URL
        ? { ok: false, error: "404 not found" }
        : { ok: true, strippedText: "Keells 25% off Validity ...", contentHash: "h1" },
    );
    const extract = vi.fn(async (sourceUrl: string) => ({
      offers: [{ ...offerFor(sourceUrl, `peoples-bank-${sourceUrl.length}`) }],
      inputTokens: 10, outputTokens: 5,
    }));

    const res = await refreshCrawlBank(entry, [], {}, reviewDate, {
      discover: async () => ({ ok: true, urls }),
      fetchDetail,
      extract,
      throttleMs: 0,
    });

    expect(res.ok).toBe(true);
    expect(res.extracted).toBe(2);
    expect(res.assetFailures).toEqual([{ url: normalizeUrl(BAD_URL), reason: "404 not found" }]);
    expect(res.assetFailures.every((f) => f.url !== normalizeUrl(URL_A) && f.url !== normalizeUrl(GOOD_URL_B))).toBe(true);
  });

  it("keeps prior offers and records assetFailures when extract throws for one url, without rejecting or dropping siblings", async () => {
    const BAD_URL = "https://www.peoplesbank.lk/promotion/broken-detail/";
    const urls: DiscoveredCrawlUrl[] = [
      { url: URL_A, type: "static_html" },
      { url: BAD_URL, type: "static_html" },
    ];
    const priorForBad = offerFor(BAD_URL, "peoples-bank-bad");
    const extract = vi.fn(async (sourceUrl: string) => {
      if (sourceUrl === BAD_URL) throw new Error("extract blew up");
      return { offers: [{ ...offerFor(sourceUrl), description: "fresh-from-detail" }], inputTokens: 5, outputTokens: 2 };
    });

    const res = await refreshCrawlBank(entry, [priorForBad], { [BAD_URL]: "OLD" }, reviewDate, baseDeps({
      extract: (sourceUrl) => extract(sourceUrl), discover: async () => ({ ok: true, urls }),
    }));

    expect(res.ok).toBe(true);
    expect(res.assetFailures).toEqual([{ url: BAD_URL, reason: "extract blew up" }]);
    expect(res.offers.some((o) => o.id === "peoples-bank-bad" && o.description === "old")).toBe(true);
    expect(res.offers.some((o) => o.sourceUrl === URL_A && o.description === "fresh-from-detail")).toBe(true);
  });

  it("does not force a trailing slash onto a discovered pdf URL used for fetching (regression test)", async () => {
    const PDF_URL = "https://www.peoplesbank.lk/files/report.pdf";
    const fetchDetail = vi.fn(async () => ({ ok: true, pdfBytes: Buffer.from("x"), contentHash: "h" }));
    const extract = vi.fn(async (sourceUrl: string) => ({ offers: [offerFor(sourceUrl)], inputTokens: 1, outputTokens: 1 }));

    await refreshCrawlBank(entry, [], {}, reviewDate, {
      discover: async () => ({ ok: true, urls: [{ url: PDF_URL, type: "pdf" }] }),
      fetchDetail,
      extract,
      throttleMs: 0,
    });

    expect(fetchDetail).toHaveBeenCalledWith(PDF_URL, "pdf");
  });

  it("uses discovery-stripped content instead of calling fetchDetail, when present", async () => {
    const fetchDetail = vi.fn(async () => ({ ok: true, strippedText: "should not be used", contentHash: "wrong" }));
    const extract = vi.fn(async (sourceUrl: string) => ({ offers: [offerFor(sourceUrl)], inputTokens: 1, outputTokens: 1 }));

    const res = await refreshCrawlBank(entry, [], {}, reviewDate, {
      discover: async () => ({
        ok: true,
        urls: [{ url: URL_A, type: "static_html", stripped: { strippedText: "Keells 25% off", contentHash: "hash:Keells 25% off" } }],
      }),
      fetchDetail,
      extract,
      throttleMs: 0,
    });

    expect(fetchDetail).not.toHaveBeenCalled();
    expect(res.detailHashes[URL_A]).toBe("hash:Keells 25% off");
  });

  it("compares a discovery-stripped page's contentHash against prevHashes and reuses without extracting", async () => {
    const fetchDetail = vi.fn(async () => ({ ok: true, strippedText: "should not be used", contentHash: "wrong" }));
    const extract = vi.fn(makeExtract());

    const res = await refreshCrawlBank(entry, [offerFor(URL_A)], { [URL_A]: "h1" }, reviewDate, {
      discover: async () => ({
        ok: true,
        urls: [{ url: URL_A, type: "static_html", stripped: { strippedText: "Keells 25% off", contentHash: "h1" } }],
      }),
      fetchDetail,
      extract: (sourceUrl) => extract(sourceUrl),
      throttleMs: 0,
    });

    expect(fetchDetail).not.toHaveBeenCalled();
    expect(extract).not.toHaveBeenCalled();
    expect(res.reused).toBe(1);
    expect(res.offers[0]?.description).toBe("old");
  });

  it("falls back to fetchDetail when the discovered url carries no stripped form (the skipAssets/no-stripper path)", async () => {
    const fetchDetail = vi.fn(async () => ({ ok: true, strippedText: "from fetchDetail", contentHash: "h1" }));
    const extract = vi.fn(async (sourceUrl: string) => ({ offers: [offerFor(sourceUrl)], inputTokens: 1, outputTokens: 1 }));

    await refreshCrawlBank(entry, [], {}, reviewDate, {
      discover: async () => ({ ok: true, urls: [{ url: URL_A, type: "static_html" }] }),
      fetchDetail,
      extract,
      throttleMs: 0,
    });

    expect(fetchDetail).toHaveBeenCalledWith(URL_A, "static_html");
  });

  it("increments extractFailures when extract throws, while still reusing prior offers", async () => {
    const extract = vi.fn(async () => { throw new Error("boom"); });
    const res = await refreshCrawlBank(entry, [offerFor(URL_A)], { [URL_A]: "OLD" }, reviewDate, baseDeps({ extract }));

    expect(res.extractFailures).toBe(1);
    expect(res.offers).toHaveLength(1);
    expect(res.offers[0]?.description).toBe("old");
  });

  it("awaits throttleMs before calling fetchDetail, not after (RC6: the sleep must guard the outbound fetch itself, not the later extract call)", async () => {
    const calls: string[] = [];
    vi.spyOn(global, "setTimeout").mockImplementation(((fn: () => void) => {
      calls.push("sleep");
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);
    const fetchDetail = vi.fn(async () => {
      calls.push("fetchDetail");
      return { ok: true, strippedText: "text", contentHash: "h" };
    });
    const extract = vi.fn(async (sourceUrl: string) => ({ offers: [offerFor(sourceUrl)], inputTokens: 1, outputTokens: 1 }));

    await refreshCrawlBank(entry, [], {}, reviewDate, {
      discover: async () => ({ ok: true, urls: [{ url: URL_A, type: "static_html" }] }),
      fetchDetail,
      extract,
      throttleMs: 5,
    });

    expect(calls).toEqual(["sleep", "fetchDetail"]);
    vi.restoreAllMocks();
  });

  it("throttles every real fetchDetail call, even ones whose hash comes back unchanged (reused, never reaching extract) — the RC6 combank-403 scenario", async () => {
    const URL_B = "https://www.peoplesbank.lk/promotion/cargills-25-off-credit/";
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const fetchDetail = vi.fn(async () => ({ ok: true, strippedText: "text", contentHash: "h1" }));
    const extract = vi.fn(makeExtract());

    const res = await refreshCrawlBank(
      entry,
      [offerFor(URL_A), offerFor(URL_B, "peoples-bank-b")],
      { [URL_A]: "h1", [URL_B]: "h1" },
      reviewDate,
      {
        discover: async () => ({ ok: true, urls: [{ url: URL_A, type: "static_html" }, { url: URL_B, type: "static_html" }] }),
        fetchDetail,
        extract: (sourceUrl) => extract(sourceUrl),
        throttleMs: 5,
      },
    );

    expect(res.reused).toBe(2);
    expect(extract).not.toHaveBeenCalled();
    expect(fetchDetail).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    setTimeoutSpy.mockRestore();
  });
});

describe("discoverCrawlUrls", () => {
  const restaurantsUrl = "https://www.peoplesbank.lk/promotion-category/restaurants/";
  const supermarketsUrl = "https://www.peoplesbank.lk/promotion-category/supermarkets/";
  const recipe: CrawlRecipe = { hops: [], detailMatch: "/promotion/[a-z0-9-]+/" };

  it("merges static_html detail pages with pdf/image assets, deduped and filtered, detail-first", async () => {
    const html: Record<string, string> = {
      [restaurantsUrl]: `
        <main>
          <a href="/promotion/plates-30-off-credit/">Plates</a>
          <a href="/files/dining-offers.pdf">Dining PDF</a>
          <img src="/banners/dining-promo.jpg" alt="promo">
          <img src="/icons/tracker" alt="no extension, filtered">
        </main>`,
      [supermarketsUrl]: `
        <main>
          <a href="/promotion/keells-25-off-credit/">Keells</a>
          <a href="/files/dining-offers.pdf">Same PDF, linked again</a>
        </main>`,
    };
    const fetchHtml = vi.fn(async (url: string) => {
      const page = html[url];
      if (page === undefined) throw new Error(`unexpected fetch ${url}`);
      return page;
    });

    const res = await discoverCrawlUrls([restaurantsUrl, supermarketsUrl], recipe, fetchHtml);

    expect(res.ok).toBe(true);
    expect(res.urls).toEqual([
      { url: "https://www.peoplesbank.lk/promotion/plates-30-off-credit/", type: "static_html" },
      { url: "https://www.peoplesbank.lk/promotion/keells-25-off-credit/", type: "static_html" },
      { url: "https://www.peoplesbank.lk/files/dining-offers.pdf", type: "pdf" },
      { url: "https://www.peoplesbank.lk/banners/dining-promo.jpg", type: "image" },
    ]);
  });

  it("skips asset discovery for a seed page whose html re-fetch fails, without failing the whole discover", async () => {
    const html: Record<string, string> = {
      [restaurantsUrl]: `<main><a href="/promotion/plates-30-off-credit/">Plates</a><a href="/files/menu.pdf">Menu</a></main>`,
      [supermarketsUrl]: `<main><a href="/promotion/keells-25-off-credit/">Keells</a></main>`,
    };
    const callCounts = new Map<string, number>();
    const fetchHtml = vi.fn(async (url: string) => {
      const count = (callCounts.get(url) ?? 0) + 1;
      callCounts.set(url, count);
      // Succeeds the first time (used by detail discovery), fails on the re-fetch used for asset scanning.
      if (url === supermarketsUrl && count > 1) throw new Error("network blip");
      const page = html[url];
      if (page === undefined) throw new Error(`unexpected fetch ${url}`);
      return page;
    });

    const res = await discoverCrawlUrls([restaurantsUrl, supermarketsUrl], recipe, fetchHtml);

    expect(res.ok).toBe(true);
    expect(res.urls).toEqual([
      { url: "https://www.peoplesbank.lk/promotion/plates-30-off-credit/", type: "static_html" },
      { url: "https://www.peoplesbank.lk/promotion/keells-25-off-credit/", type: "static_html" },
      { url: "https://www.peoplesbank.lk/files/menu.pdf", type: "pdf" },
    ]);
  });

  it("returns ok:false and never scans for assets when detail discovery fails", async () => {
    const fetchHtml = vi.fn(async () => {
      throw new Error("boom");
    });
    const res = await discoverCrawlUrls([restaurantsUrl], recipe, fetchHtml);
    expect(res.ok).toBe(false);
    expect(fetchHtml).toHaveBeenCalledTimes(1);
  });

  it("discovers assets on detail pages, not just seed pages", async () => {
    const detailUrl = "https://www.peoplesbank.lk/promotion/plates-30-off-credit/";
    const html: Record<string, string> = {
      [restaurantsUrl]: `<main><a href="/promotion/plates-30-off-credit/">Plates</a></main>`,
      [detailUrl]: `<main><img src="/banners/plates-promo.jpg" alt="promo"></main>`,
    };
    const fetchHtml = vi.fn(async (url: string) => {
      const page = html[url];
      if (page === undefined) throw new Error(`unexpected fetch ${url}`);
      return page;
    });

    const res = await discoverCrawlUrls([restaurantsUrl], recipe, fetchHtml);

    expect(res.ok).toBe(true);
    expect(res.urls).toEqual([
      { url: detailUrl, type: "static_html" },
      { url: "https://www.peoplesbank.lk/banners/plates-promo.jpg", type: "image" },
    ]);
  });

  it("discovers a cross-host detail-page asset only when its host is passed as assetHosts", async () => {
    const detailUrl = "https://www.peoplesbank.lk/promotion/plates-30-off-credit/";
    const crossHostImage = "https://cdn.example.com/banners/plates-promo.jpg";
    const html: Record<string, string> = {
      [restaurantsUrl]: `<main><a href="/promotion/plates-30-off-credit/">Plates</a></main>`,
      [detailUrl]: `<main><img src="${crossHostImage}" alt="promo"></main>`,
    };
    const fetchHtml = vi.fn(async (url: string) => {
      const page = html[url];
      if (page === undefined) throw new Error(`unexpected fetch ${url}`);
      return page;
    });

    const withoutAllowlist = await discoverCrawlUrls([restaurantsUrl], recipe, fetchHtml);
    expect(withoutAllowlist.urls).toEqual([{ url: detailUrl, type: "static_html" }]);

    const withAllowlist = await discoverCrawlUrls([restaurantsUrl], recipe, fetchHtml, ["cdn.example.com"]);
    expect(withAllowlist.urls).toEqual([
      { url: detailUrl, type: "static_html" },
      { url: crossHostImage, type: "image" },
    ]);
  });

  it("dedupes a detail-page asset against the same asset already found on a seed page", async () => {
    const detailUrl = "https://www.peoplesbank.lk/promotion/plates-30-off-credit/";
    const sharedImage = "/banners/shared-promo.jpg";
    const html: Record<string, string> = {
      [restaurantsUrl]: `<main><a href="/promotion/plates-30-off-credit/">Plates</a><img src="${sharedImage}" alt="promo"></main>`,
      [detailUrl]: `<main><img src="${sharedImage}" alt="promo"></main>`,
    };
    const fetchHtml = vi.fn(async (url: string) => {
      const page = html[url];
      if (page === undefined) throw new Error(`unexpected fetch ${url}`);
      return page;
    });

    const res = await discoverCrawlUrls([restaurantsUrl], recipe, fetchHtml);

    expect(res.urls).toEqual([
      { url: detailUrl, type: "static_html" },
      { url: "https://www.peoplesbank.lk/banners/shared-promo.jpg", type: "image" },
    ]);
  });

  it("does not fail the whole discovery when a detail page's html re-fetch fails during asset scanning", async () => {
    const detailUrl = "https://www.peoplesbank.lk/promotion/plates-30-off-credit/";
    const html: Record<string, string> = {
      [restaurantsUrl]: `<main><a href="/promotion/plates-30-off-credit/">Plates</a><a href="/files/menu.pdf">Menu</a></main>`,
    };
    const fetchHtml = vi.fn(async (url: string) => {
      // Detail pages are never fetched by discoverDetailUrls itself for a hops:[] recipe (detail
      // links are read straight from the seed's html), so this throw only ever hits the new
      // detail-page asset-scan pass, not detail discovery.
      if (url === detailUrl) throw new Error("network blip");
      const page = html[url];
      if (page === undefined) throw new Error(`unexpected fetch ${url}`);
      return page;
    });

    const res = await discoverCrawlUrls([restaurantsUrl], recipe, fetchHtml);

    expect(res.ok).toBe(true);
    expect(res.urls).toEqual([
      { url: detailUrl, type: "static_html" },
      { url: "https://www.peoplesbank.lk/files/menu.pdf", type: "pdf" },
    ]);
  });

  it("strips each discovered detail page's html via the supplied stripper, attaching {strippedText, contentHash} instead of raw html", async () => {
    const detailUrl = "https://www.peoplesbank.lk/promotion/plates-30-off-credit/";
    // The fake stripper below only trims whitespace (it doesn't parse tags like the real cheerio-based
    // stripHtml does) — so this page's fixture is already plain text, no markup to strip.
    const html: Record<string, string> = {
      [restaurantsUrl]: `<main><a href="/promotion/plates-30-off-credit/">Plates</a></main>`,
      [detailUrl]: ` Plates 30% off `,
    };
    const fetchHtml = vi.fn(async (url: string) => {
      const page = html[url];
      if (page === undefined) throw new Error(`unexpected fetch ${url}`);
      return page;
    });
    const stripHtml = vi.fn((raw: string) => ({ strippedText: raw.trim(), contentHash: `hash:${raw.trim()}` }));

    const res = await discoverCrawlUrls([restaurantsUrl], recipe, fetchHtml, [], false, stripHtml);

    expect(stripHtml).toHaveBeenCalledWith(html[detailUrl]);
    expect(res.urls).toEqual([
      { url: detailUrl, type: "static_html", stripped: { strippedText: "Plates 30% off", contentHash: "hash:Plates 30% off" } },
    ]);
  });

  it("does not attach a stripped form, and never calls a stripper, when none is supplied", async () => {
    const detailUrl = "https://www.peoplesbank.lk/promotion/plates-30-off-credit/";
    const html: Record<string, string> = {
      [restaurantsUrl]: `<main><a href="/promotion/plates-30-off-credit/">Plates</a></main>`,
      [detailUrl]: `<main>Plates 30% off</main>`,
    };
    const fetchHtml = vi.fn(async (url: string) => {
      const page = html[url];
      if (page === undefined) throw new Error(`unexpected fetch ${url}`);
      return page;
    });

    const res = await discoverCrawlUrls([restaurantsUrl], recipe, fetchHtml);

    expect(res.urls).toEqual([{ url: detailUrl, type: "static_html" }]);
  });

  it("carries a detail page's og:image as its stripped.ogImageUrl when the page has no image asset of its own", async () => {
    const detailUrl = "https://www.peoplesbank.lk/promotion/plates-30-off-credit/";
    const html: Record<string, string> = {
      [restaurantsUrl]: `<main><a href="/promotion/plates-30-off-credit/">Plates</a></main>`,
      [detailUrl]: `<html><head><meta property="og:image" content="/social/plates-share.jpg"></head><body><main>Plates 30% off</main></body></html>`,
    };
    const fetchHtml = vi.fn(async (url: string) => {
      const page = html[url];
      if (page === undefined) throw new Error(`unexpected fetch ${url}`);
      return page;
    });
    const stripHtml = vi.fn((raw: string) => ({ strippedText: "Plates 30% off", contentHash: "h1" }));

    const res = await discoverCrawlUrls([restaurantsUrl], recipe, fetchHtml, [], false, stripHtml);

    expect(res.urls).toEqual([
      {
        url: detailUrl,
        type: "static_html",
        stripped: { strippedText: "Plates 30% off", contentHash: "h1", ogImageUrl: "https://www.peoplesbank.lk/social/plates-share.jpg" },
      },
    ]);
  });

  it("omits ogImageUrl when the detail page has its own image asset — that asset gets its own extraction instead", async () => {
    const detailUrl = "https://www.peoplesbank.lk/promotion/plates-30-off-credit/";
    const html: Record<string, string> = {
      [restaurantsUrl]: `<main><a href="/promotion/plates-30-off-credit/">Plates</a></main>`,
      [detailUrl]: `<html><head><meta property="og:image" content="/social/plates-share.jpg"></head><body><main><img src="/banners/plates-promo.jpg" alt="promo">Plates 30% off</main></body></html>`,
    };
    const fetchHtml = vi.fn(async (url: string) => {
      const page = html[url];
      if (page === undefined) throw new Error(`unexpected fetch ${url}`);
      return page;
    });
    const stripHtml = vi.fn((raw: string) => ({ strippedText: "Plates 30% off", contentHash: "h1" }));

    const res = await discoverCrawlUrls([restaurantsUrl], recipe, fetchHtml, [], false, stripHtml);

    expect(res.urls).toEqual([
      { url: detailUrl, type: "static_html", stripped: { strippedText: "Plates 30% off", contentHash: "h1" } },
      { url: "https://www.peoplesbank.lk/banners/plates-promo.jpg", type: "image" },
    ]);
  });
});

describe("collectPageAssets", () => {
  const pageA = "https://www.peoplesbank.lk/promotion/plates-30-off-credit/";
  const pageB = "https://www.peoplesbank.lk/promotion/keells-25-off-credit/";

  it("dedupes the same asset URL found across two different pages", () => {
    const rawHtml = `<main><img src="/banners/shared-promo.jpg" alt="promo"></main>`;

    const assets = collectPageAssets([
      { url: pageA, rawHtml },
      { url: pageB, rawHtml },
    ]);

    expect(assets).toEqual([
      { url: "https://www.peoplesbank.lk/banners/shared-promo.jpg", type: "image" },
    ]);
  });

  it("filters out junk images: a data-URI image and an extension-less image", () => {
    const rawHtml = `
      <main>
        <img src="data:image/png;base64,AAA" alt="inline">
        <img src="/icons/tracker" alt="no extension">
      </main>`;

    expect(collectPageAssets([{ url: pageA, rawHtml }])).toEqual([]);
  });

  it("includes a cross-host image only when its host is passed in assetHosts", () => {
    const rawHtml = `<main><img src="https://cdn.example.com/banners/promo.jpg" alt="promo"></main>`;

    expect(collectPageAssets([{ url: pageA, rawHtml }])).toEqual([]);
    expect(collectPageAssets([{ url: pageA, rawHtml }], ["cdn.example.com"])).toEqual([
      { url: "https://cdn.example.com/banners/promo.jpg", type: "image" },
    ]);
  });

  it("skips a page whose url fails URL parsing, without throwing or affecting other pages' assets", () => {
    const assets = collectPageAssets([
      { url: "not a url", rawHtml: `<main><img src="/banners/broken.jpg" alt="promo"></main>` },
      { url: pageA, rawHtml: `<main><img src="/banners/shared-promo.jpg" alt="promo"></main>` },
    ]);

    expect(assets).toEqual([
      { url: "https://www.peoplesbank.lk/banners/shared-promo.jpg", type: "image" },
    ]);
  });
});

describe("MIN_ASSET_IMAGE_BYTES", () => {
  it("is 10 KiB", () => {
    expect(MIN_ASSET_IMAGE_BYTES).toBe(10 * 1024);
  });
});
