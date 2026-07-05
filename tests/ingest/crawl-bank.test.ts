import { describe, expect, it } from "vitest";
import {
  normalizeUrl,
  extractLinks,
  discoverDetailUrls,
  discoverAssetUrls,
  type CrawlRecipe,
} from "@/lib/ingest/crawlBank";

describe("normalizeUrl", () => {
  it("lowercases host, drops fragment, adds a trailing slash", () => {
    expect(normalizeUrl("https://WWW.Peoplesbank.LK/promotion/keells-25-off-credit#share"))
      .toBe("https://www.peoplesbank.lk/promotion/keells-25-off-credit/");
  });
  it("keeps an existing trailing slash and preserves query", () => {
    expect(normalizeUrl("https://www.peoplesbank.lk/promotion-category/wellness/?cardType=credit_card"))
      .toBe("https://www.peoplesbank.lk/promotion-category/wellness/?cardType=credit_card");
  });
});

describe("extractLinks", () => {
  const base = "https://www.peoplesbank.lk/promotion-category/restaurants/?cardType=credit_card";
  const html = `
    <a href="/promotion/keells-25-off-credit/">Keells</a>
    <a href="https://www.peoplesbank.lk/promotion/keells-25-off-credit/#x">dup</a>
    <a href="/promotion-category/restaurants/?cardType=credit_card">category (excluded)</a>
    <a href="https://facebook.com/promotion/offsite/">offsite (excluded)</a>
    <a href="/about-us/">nav (excluded)</a>`;

  it("returns deduped, same-origin detail links matching the pattern", () => {
    const links = extractLinks(html, base, /\/promotion\/[a-z0-9-]+\//);
    expect(links).toEqual(["https://www.peoplesbank.lk/promotion/keells-25-off-credit/"]);
  });

  it("matches against pathname + search so query filters work", () => {
    const links = extractLinks(html, base, /\/promotion-category\/.*cardType=credit_card/);
    expect(links).toEqual(["https://www.peoplesbank.lk/promotion-category/restaurants/?cardType=credit_card"]);
  });
});

const indexHtml = `<a href="/promotion-category/restaurants/?cardType=credit_card">Restaurants</a>
  <a href="/promotion-category/supermarkets/?cardType=credit_card">Supermarkets</a>
  <a href="/promotion-category/leisure/?cardType=debit_card">Debit (excluded)</a>`;
const restaurantsHtml = `<a href="/promotion/plates-30-off-credit/">A</a><a href="/promotion/radisson-40-off-credit/">B</a>`;
const supermarketsHtml = `<a href="/promotion/keells-25-off-credit/">C</a>`;

function fakeFetcher(map: Record<string, string>): (url: string) => Promise<string> {
  return async (url: string) => {
    const html = map[url];
    if (html === undefined) throw new Error(`unexpected fetch ${url}`);
    return html;
  };
}

const peoplesRecipe: CrawlRecipe = {
  hops: ["/promotion-category/.*cardType=credit_card"],
  detailMatch: "/promotion/[a-z0-9-]+/",
};

describe("discoverDetailUrls", () => {
  it("walks index -> credit categories -> detail urls", async () => {
    const fetchHtml = fakeFetcher({
      "https://www.peoplesbank.lk/special-offers/": indexHtml,
      "https://www.peoplesbank.lk/promotion-category/restaurants/?cardType=credit_card": restaurantsHtml,
      "https://www.peoplesbank.lk/promotion-category/supermarkets/?cardType=credit_card": supermarketsHtml,
    });
    const res = await discoverDetailUrls(["https://www.peoplesbank.lk/special-offers/"], peoplesRecipe, fetchHtml);
    expect(res.ok).toBe(true);
    expect(new Set(res.urls)).toEqual(new Set([
      "https://www.peoplesbank.lk/promotion/plates-30-off-credit/",
      "https://www.peoplesbank.lk/promotion/radisson-40-off-credit/",
      "https://www.peoplesbank.lk/promotion/keells-25-off-credit/",
    ]));
  });

  it("returns ok:false when a hop matches nothing", async () => {
    const fetchHtml = fakeFetcher({ "https://www.peoplesbank.lk/special-offers/": "<a href='/about/'>x</a>" });
    const res = await discoverDetailUrls(["https://www.peoplesbank.lk/special-offers/"], peoplesRecipe, fetchHtml);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no links matched hop/);
  });

  it("returns ok:false when a fetch throws", async () => {
    const fetchHtml = fakeFetcher({}); // any url throws
    const res = await discoverDetailUrls(["https://www.peoplesbank.lk/special-offers/"], peoplesRecipe, fetchHtml);
    expect(res.ok).toBe(false);
  });
});

describe("discoverAssetUrls", () => {
  const base = "https://www.example.lk/offers/";

  it("excludes nav/header/footer chrome and finds the real PDF and image in main content", () => {
    const html = `
      <nav><a href="/about/">About</a><img src="/logo.png" alt="logo"></nav>
      <header><img src="/nav-icon.png" alt="menu"></header>
      <main>
        <a href="/promotions/">See all offers</a>
        <a href="/files/dining-offers.pdf">Download offers PDF</a>
        <img src="/banners/dining-promo.jpg" alt="Dining promo">
      </main>
      <footer><a href="/legal/terms.pdf">Terms and conditions</a></footer>`;

    // Order reflects discovery-pass order (PDFs pass, then images pass), not raw document position.
    expect(discoverAssetUrls(html, base)).toEqual([
      { url: "https://www.example.lk/files/dining-offers.pdf", type: "pdf" },
      { url: "https://www.example.lk/banners/dining-promo.jpg", type: "image" },
    ]);
  });

  it("excludes offsite links and images that don't share the base hostname", () => {
    const html = `
      <main>
        <a href="/files/dining-offers.pdf">Same-origin PDF</a>
        <a href="https://cdn.otherdomain.com/x.pdf">Offsite PDF (excluded)</a>
        <img src="/banners/dining-promo.jpg" alt="Dining promo">
        <img src="https://cdn.otherdomain.com/y.jpg" alt="Offsite image (excluded)">
      </main>`;

    expect(discoverAssetUrls(html, base)).toEqual([
      { url: "https://www.example.lk/files/dining-offers.pdf", type: "pdf" },
      { url: "https://www.example.lk/banners/dining-promo.jpg", type: "image" },
    ]);
  });

  it("does not add a spurious trailing slash to file URLs (normalizeAssetUrl, not normalizeUrl)", () => {
    const html = `<main><a href="/files/report.pdf">Report</a></main>`;

    const [asset] = discoverAssetUrls(html, base);
    expect(asset.url).toBe("https://www.example.lk/files/report.pdf");
  });

  it("dedupes the same PDF href appearing more than once", () => {
    const html = `
      <main>
        <a href="/files/dining-offers.pdf">Download</a>
        <a href="/files/dining-offers.pdf">Download again</a>
      </main>`;

    expect(discoverAssetUrls(html, base)).toEqual([
      { url: "https://www.example.lk/files/dining-offers.pdf", type: "pdf" },
    ]);
  });

  it("accepts a cross-host image and pdf when their hostname is passed in assetHosts", () => {
    const html = `
      <main>
        <a href="https://s3.ap-southeast-1.amazonaws.com/files/dining-offers.pdf">Offsite PDF (allowed)</a>
        <img src="https://s3.ap-southeast-1.amazonaws.com/banners/dining-promo.jpg" alt="Offsite image (allowed)">
      </main>`;

    expect(discoverAssetUrls(html, base, ["s3.ap-southeast-1.amazonaws.com"])).toEqual([
      { url: "https://s3.ap-southeast-1.amazonaws.com/files/dining-offers.pdf", type: "pdf" },
      { url: "https://s3.ap-southeast-1.amazonaws.com/banners/dining-promo.jpg", type: "image" },
    ]);
  });

  it("still rejects a cross-host asset whose host is not in assetHosts", () => {
    const html = `
      <main>
        <a href="https://cdn.otherdomain.com/x.pdf">Offsite PDF (excluded)</a>
        <img src="https://cdn.otherdomain.com/y.jpg" alt="Offsite image (excluded)">
      </main>`;

    expect(discoverAssetUrls(html, base, ["s3.ap-southeast-1.amazonaws.com"])).toEqual([]);
  });

  it("still includes a base-host asset alongside an allowlisted cross-host asset", () => {
    const html = `
      <main>
        <a href="/files/dining-offers.pdf">Same-origin PDF</a>
        <img src="https://s3.ap-southeast-1.amazonaws.com/banners/dining-promo.jpg" alt="Offsite image (allowed)">
      </main>`;

    expect(discoverAssetUrls(html, base, ["s3.ap-southeast-1.amazonaws.com"])).toEqual([
      { url: "https://www.example.lk/files/dining-offers.pdf", type: "pdf" },
      { url: "https://s3.ap-southeast-1.amazonaws.com/banners/dining-promo.jpg", type: "image" },
    ]);
  });
});
