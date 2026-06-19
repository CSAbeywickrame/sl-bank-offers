import { describe, expect, it } from "vitest";
import { normalizeUrl, extractLinks, discoverDetailUrls, type CrawlRecipe } from "@/lib/ingest/crawlBank";

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
