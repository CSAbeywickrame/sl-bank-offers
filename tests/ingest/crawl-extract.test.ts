import { describe, expect, it, vi } from "vitest";
import {
  refreshCrawlBank,
  groupOffersBySourceUrl,
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
