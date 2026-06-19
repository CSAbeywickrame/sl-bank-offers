# Deep-Crawl Offer Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore rich per-offer data and deep "view at bank" links by crawling each offer's detail page, while only sending new/changed pages to Claude.

**Architecture:** A per-bank `crawl` recipe (`hops` + `detailMatch`) drives a shared crawl engine that walks an index → intermediate pages → detail-page URLs. Each detail page is fetched, hashed, and only extracted with Claude when its hash changed since last run (unchanged pages reuse the stored offer for free). People's Bank is wired as the reference; the engine generalizes to other static banks later.

**Tech Stack:** TypeScript (ESM, `@/*` → repo root), Next.js 16, cheerio, Playwright (existing, dynamic only), `@anthropic-ai/sdk` (Claude Haiku 4.5), vitest, tsx.

## Global Constraints

- TypeScript strict; `npm run lint` (= `next typegen && tsc --noEmit`) must pass.
- ESM only; import internal modules via the `@/` alias (e.g. `@/lib/ingest/crawlBank`).
- Tests: vitest, files at `tests/**/*.test.ts`, `@` alias resolves to repo root. Run with `npx vitest run <path>`.
- Extraction model is **`claude-haiku-4-5-20251001`** (single constant; revert to `claude-sonnet-4-6` if quality regresses).
- Fetchers and the crawl engine **never throw to the orchestrator** — they return `{ ok:false, error }`; a broken crawl keeps the bank's existing rows and spends **zero** Claude tokens.
- Per-offer `sourceUrl` = `termsLink` default = the offer's own **detail-page URL** (the deep link).
- **COMMITS:** Per project rule, do NOT run the `git commit` step in any task unless the user explicitly authorizes committing. Treat each "Commit" step as a checkpoint (stage with `git add` only, or skip).
- **CODE AUTHORING:** Per project rule, write each task's code via the `atomic-code-writer` agent and run a code review after each task.

---

## File Structure

- `lib/ingest/crawlBank.ts` (new) — pure crawl engine: `normalizeUrl`, `extractLinks`, `discoverDetailUrls`, plus `CrawlRecipe`/`DiscoverResult`/`HtmlFetcher` types.
- `lib/ingest/crawlExtract.ts` (new) — per-bank crawl orchestration: `groupOffersBySourceUrl`, `refreshCrawlBank` (discovery → per-detail hash-gate → reuse/extract → assemble).
- `lib/ingest/fetchAndStrip.ts` (modify) — add `fetchRawHtml(url)` (raw HTML, links intact) + a politeness throttle.
- `lib/ingest/extractWithClaude.ts` (modify) — model constant → Haiku, exported as `EXTRACTION_MODEL`.
- `lib/sources/bankRegistry.ts` (modify) — import `CrawlRecipe`, add optional `crawl?` to `RegistrySource`, add People's recipe.
- `scripts/refresh.ts` (modify) — branch crawl sources into `refreshCrawlBank`; add `details` to `RefreshState`; add `ONLY_BANKS` and `MAX_DETAILS_PER_RUN` env controls.
- Tests (new): `tests/ingest/crawl-bank.test.ts`, `tests/ingest/crawl-extract.test.ts`, `tests/ingest/fetch-raw-html.test.ts`, `tests/sources/registry-crawl.test.ts`, `tests/ingest/extraction-model.test.ts`.

---

### Task 1: Extraction model → Haiku

**Files:**
- Modify: `lib/ingest/extractWithClaude.ts:7`
- Test: `tests/ingest/extraction-model.test.ts`

**Interfaces:**
- Produces: `export const EXTRACTION_MODEL = "claude-haiku-4-5-20251001"` from `@/lib/ingest/extractWithClaude`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ingest/extraction-model.test.ts
import { describe, expect, it } from "vitest";
import { EXTRACTION_MODEL } from "@/lib/ingest/extractWithClaude";

describe("extraction model", () => {
  it("uses Claude Haiku 4.5 for offer extraction", () => {
    expect(EXTRACTION_MODEL).toBe("claude-haiku-4-5-20251001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/extraction-model.test.ts`
Expected: FAIL — `EXTRACTION_MODEL` is not exported.

- [ ] **Step 3: Make the change**

In `lib/ingest/extractWithClaude.ts`, replace line 7:

```ts
export const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";
```

Then replace the model reference inside `client.messages.stream({ model: MODEL, ... })` with `model: EXTRACTION_MODEL,` and delete the now-unused `const MODEL = ...`.

- [ ] **Step 4: Run test + lint**

Run: `npx vitest run tests/ingest/extraction-model.test.ts && npm run lint`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit (checkpoint — see Global Constraints)**

```bash
git add lib/ingest/extractWithClaude.ts tests/ingest/extraction-model.test.ts
git commit -m "chore(extract): switch extraction model to Claude Haiku 4.5"
```

---

### Task 2: `normalizeUrl`

**Files:**
- Create: `lib/ingest/crawlBank.ts`
- Test: `tests/ingest/crawl-bank.test.ts`

**Interfaces:**
- Produces: `export function normalizeUrl(input: string): string` — lowercase host, drop fragment, ensure a single trailing slash on the path. Throws on a non-absolute URL.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ingest/crawl-bank.test.ts
import { describe, expect, it } from "vitest";
import { normalizeUrl } from "@/lib/ingest/crawlBank";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/crawl-bank.test.ts`
Expected: FAIL — module `@/lib/ingest/crawlBank` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ingest/crawlBank.ts
import * as cheerio from "cheerio";

// Normalize a URL for stable comparison/keys: lowercase host, strip fragment, single trailing slash on the path.
export function normalizeUrl(input: string): string {
  const u = new URL(input);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  if (!u.pathname.endsWith("/")) u.pathname = `${u.pathname}/`;
  return u.toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ingest/crawl-bank.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add lib/ingest/crawlBank.ts tests/ingest/crawl-bank.test.ts
git commit -m "feat(crawl): add normalizeUrl"
```

---

### Task 2 continued via Task 3 and Task 4 use the same files (`crawlBank.ts` + `crawl-bank.test.ts`).

### Task 3: `extractLinks`

**Files:**
- Modify: `lib/ingest/crawlBank.ts`
- Test: `tests/ingest/crawl-bank.test.ts`

**Interfaces:**
- Consumes: `normalizeUrl`.
- Produces: `export function extractLinks(html: string, baseUrl: string, pattern: RegExp): string[]` — absolute, same-origin links whose `pathname + search` matches `pattern`, resolved against `baseUrl`, deduped + normalized.

- [ ] **Step 1: Write the failing test (append to the existing describe file)**

```ts
// add to tests/ingest/crawl-bank.test.ts
import { extractLinks } from "@/lib/ingest/crawlBank";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/crawl-bank.test.ts`
Expected: FAIL — `extractLinks` is not exported.

- [ ] **Step 3: Write minimal implementation (append to `crawlBank.ts`)**

```ts
// Extract absolute, same-origin links from html whose `pathname + search` matches `pattern`,
// resolved against baseUrl, deduped + normalized.
export function extractLinks(html: string, baseUrl: string, pattern: RegExp): string[] {
  const base = new URL(baseUrl);
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      return;
    }
    if (abs.hostname.toLowerCase() !== base.hostname.toLowerCase()) return;
    if (!pattern.test(`${abs.pathname}${abs.search}`)) return;
    out.add(normalizeUrl(abs.toString()));
  });
  return [...out];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ingest/crawl-bank.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add lib/ingest/crawlBank.ts tests/ingest/crawl-bank.test.ts
git commit -m "feat(crawl): add extractLinks"
```

---

### Task 4: `discoverDetailUrls` + recipe types

**Files:**
- Modify: `lib/ingest/crawlBank.ts`
- Test: `tests/ingest/crawl-bank.test.ts`

**Interfaces:**
- Consumes: `extractLinks`, `normalizeUrl`.
- Produces:
  - `export interface CrawlRecipe { hops: string[]; detailMatch: string; render?: "static" | "dynamic" }`
  - `export interface DiscoverResult { ok: boolean; urls?: string[]; error?: string }`
  - `export type HtmlFetcher = (url: string) => Promise<string>`
  - `export async function discoverDetailUrls(seedUrls: string[], recipe: CrawlRecipe, fetchHtml: HtmlFetcher): Promise<DiscoverResult>` — walks each hop (index → intermediate pages), then collects `detailMatch` links from the leaf pages. Returns `{ ok:false, error }` if any level is empty or a fetch throws.

- [ ] **Step 1: Write the failing test (append)**

```ts
// add to tests/ingest/crawl-bank.test.ts
import { discoverDetailUrls, type CrawlRecipe } from "@/lib/ingest/crawlBank";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/crawl-bank.test.ts`
Expected: FAIL — `discoverDetailUrls`/`CrawlRecipe` not exported.

- [ ] **Step 3: Write minimal implementation (append)**

```ts
export interface CrawlRecipe {
  hops: string[];
  detailMatch: string;
  render?: "static" | "dynamic";
}

export interface DiscoverResult {
  ok: boolean;
  urls?: string[];
  error?: string;
}

export type HtmlFetcher = (url: string) => Promise<string>;

// Walks the index -> intermediate (hops) -> detail-page URLs. Never throws.
export async function discoverDetailUrls(
  seedUrls: string[],
  recipe: CrawlRecipe,
  fetchHtml: HtmlFetcher,
): Promise<DiscoverResult> {
  try {
    let pages = [...new Set(seedUrls.map(normalizeUrl))];
    for (const hop of recipe.hops) {
      const re = new RegExp(hop);
      const next = new Set<string>();
      for (const page of pages) {
        const html = await fetchHtml(page);
        for (const link of extractLinks(html, page, re)) next.add(link);
      }
      if (next.size === 0) return { ok: false, error: `no links matched hop ${hop}` };
      pages = [...next];
    }
    const detailRe = new RegExp(recipe.detailMatch);
    const details = new Set<string>();
    for (const page of pages) {
      const html = await fetchHtml(page);
      for (const link of extractLinks(html, page, detailRe)) details.add(link);
    }
    if (details.size === 0) return { ok: false, error: `no detail links matched ${recipe.detailMatch}` };
    return { ok: true, urls: [...details] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ingest/crawl-bank.test.ts && npm run lint`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add lib/ingest/crawlBank.ts tests/ingest/crawl-bank.test.ts
git commit -m "feat(crawl): add discoverDetailUrls recipe engine"
```

---

### Task 5: `fetchRawHtml`

**Files:**
- Modify: `lib/ingest/fetchAndStrip.ts`
- Test: `tests/ingest/fetch-raw-html.test.ts`

**Interfaces:**
- Produces: `export async function fetchRawHtml(url: string): Promise<string>` — fetches a URL (UA header, timeout, one retry via the existing `fetchWithTimeout`) and returns the **raw HTML** (links intact), after a politeness throttle. Throws on fetch failure (used as the `HtmlFetcher` for discovery, which catches).

- [ ] **Step 1: Write the failing test**

```ts
// tests/ingest/fetch-raw-html.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRawHtml } from "@/lib/ingest/fetchAndStrip";

afterEach(() => vi.unstubAllGlobals());

describe("fetchRawHtml", () => {
  it("returns the raw HTML body with links intact", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('<a href="/promotion/x/">x</a>', { status: 200 })));
    const html = await fetchRawHtml("https://www.peoplesbank.lk/special-offers/");
    expect(html).toContain('href="/promotion/x/"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/fetch-raw-html.test.ts`
Expected: FAIL — `fetchRawHtml` not exported.

- [ ] **Step 3: Write minimal implementation**

In `lib/ingest/fetchAndStrip.ts`, add a throttle constant near the top (after `USER_AGENT`):

```ts
const CRAWL_THROTTLE_MS = 300;
```

Then add (after `fetchWithTimeout`, which is in-module):

```ts
// Fetches a URL and returns the raw HTML (links intact) for crawling. Throttled for politeness; throws on failure.
export async function fetchRawHtml(url: string): Promise<string> {
  await sleep(CRAWL_THROTTLE_MS);
  const res = await fetchWithTimeout(url, {});
  return res.text();
}
```

- [ ] **Step 4: Run test + lint**

Run: `npx vitest run tests/ingest/fetch-raw-html.test.ts && npm run lint`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add lib/ingest/fetchAndStrip.ts tests/ingest/fetch-raw-html.test.ts
git commit -m "feat(crawl): add fetchRawHtml for link-preserving fetches"
```

---

### Task 6: Registry `crawl` recipe + People's wiring

**Files:**
- Modify: `lib/sources/bankRegistry.ts:19-22` (RegistrySource), `lib/sources/bankRegistry.ts:95` (People's source)
- Test: `tests/sources/registry-crawl.test.ts`

**Interfaces:**
- Consumes: `CrawlRecipe` from `@/lib/ingest/crawlBank`.
- Produces: `RegistrySource.crawl?: CrawlRecipe`; People's source carries the recipe `{ hops: ["/promotion-category/.*cardType=credit_card"], detailMatch: "/promotion/[a-z0-9-]+/" }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/sources/registry-crawl.test.ts
import { describe, expect, it } from "vitest";
import { bankRegistry } from "@/lib/sources/bankRegistry";

describe("People's Bank crawl recipe", () => {
  it("declares a credit-only category hop and a /promotion/ detail matcher", () => {
    const peoples = bankRegistry.find((b) => b.bankId === "peoples-bank");
    const crawl = peoples?.sources[0]?.crawl;
    expect(crawl).toBeDefined();
    expect(crawl?.hops).toEqual(["/promotion-category/.*cardType=credit_card"]);
    expect(crawl?.detailMatch).toBe("/promotion/[a-z0-9-]+/");
    // The detail matcher must NOT match a category URL.
    expect(new RegExp(crawl!.detailMatch).test("/promotion-category/wellness/")).toBe(false);
    expect(new RegExp(crawl!.detailMatch).test("/promotion/keells-25-off-credit/")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sources/registry-crawl.test.ts`
Expected: FAIL — `crawl` is undefined.

- [ ] **Step 3: Make the change**

In `lib/sources/bankRegistry.ts`, add the import near the top type imports:

```ts
import type { CrawlRecipe } from "@/lib/ingest/crawlBank";
```

Extend `RegistrySource`:

```ts
export interface RegistrySource {
  url: string;
  type: RegistrySourceType;
  crawl?: CrawlRecipe; // when set, the orchestrator crawls detail pages instead of extracting this page directly
}
```

Replace the People's source array (`sources: [{ url: "https://www.peoplesbank.lk/special-offers/", type: "static_html" }]`) with:

```ts
    sources: [
      {
        url: "https://www.peoplesbank.lk/special-offers/",
        type: "static_html",
        // Index -> credit-card category pages -> per-offer /promotion/<slug>/ detail pages (all static).
        crawl: {
          hops: ["/promotion-category/.*cardType=credit_card"],
          detailMatch: "/promotion/[a-z0-9-]+/",
        },
      },
    ]
```

- [ ] **Step 4: Run test + lint**

Run: `npx vitest run tests/sources/registry-crawl.test.ts && npm run lint`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add lib/sources/bankRegistry.ts tests/sources/registry-crawl.test.ts
git commit -m "feat(registry): add crawl recipe + People's wiring"
```

---

### Task 7: `refreshCrawlBank` (discovery → hash-gate → reuse/extract)

**Files:**
- Create: `lib/ingest/crawlExtract.ts`
- Test: `tests/ingest/crawl-extract.test.ts`

**Interfaces:**
- Consumes: `normalizeUrl` from `@/lib/ingest/crawlBank`; `ScannedOffer` from `@/lib/offers/types`; `BankRegistryEntry` from `@/lib/sources/bankRegistry`.
- Produces:
  - `export function groupOffersBySourceUrl(offers: ScannedOffer[]): Map<string, ScannedOffer[]>`
  - `export interface CrawlExtractDeps { discover: () => Promise<{ ok: boolean; urls?: string[]; error?: string }>; fetchDetail: (url: string) => Promise<{ ok: boolean; strippedText?: string; contentHash?: string; error?: string }>; extract: (sourceUrl: string, strippedText: string) => Promise<{ offers: ScannedOffer[]; inputTokens: number; outputTokens: number }>; throttleMs?: number; maxExtractions?: number }`
  - `export interface CrawlExtractResult { ok: boolean; error?: string; offers: ScannedOffer[]; detailHashes: Record<string, string>; inputTokens: number; outputTokens: number; discovered: number; extracted: number; reused: number }`
  - `export async function refreshCrawlBank(entry: BankRegistryEntry, snapshot: ScannedOffer[], prevHashes: Record<string, string>, reviewDateIso: string, deps: CrawlExtractDeps): Promise<CrawlExtractResult>`

Behaviour: discover detail URLs (→ `ok:false` if discovery fails/empty, zero extract calls); for each URL fetch+hash; **unchanged hash + a stored offer → reuse free**; new/changed → `extract` once and force `sourceUrl` = the detail URL; a detail fetch failure keeps the stored offer for that URL without advancing its hash; `maxExtractions` caps fresh extractions per run (over the cap → reuse-or-skip, hash not advanced so it retries next run).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/ingest/crawl-extract.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/crawl-extract.test.ts`
Expected: FAIL — module `@/lib/ingest/crawlExtract` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ingest/crawlExtract.ts
import { normalizeUrl } from "@/lib/ingest/crawlBank";
import type { ScannedOffer } from "@/lib/offers/types";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";

export interface CrawlExtractDeps {
  discover: () => Promise<{ ok: boolean; urls?: string[]; error?: string }>;
  fetchDetail: (url: string) => Promise<{ ok: boolean; strippedText?: string; contentHash?: string; error?: string }>;
  extract: (sourceUrl: string, strippedText: string) => Promise<{ offers: ScannedOffer[]; inputTokens: number; outputTokens: number }>;
  throttleMs?: number;
  maxExtractions?: number;
}

export interface CrawlExtractResult {
  ok: boolean;
  error?: string;
  offers: ScannedOffer[];
  detailHashes: Record<string, string>;
  inputTokens: number;
  outputTokens: number;
  discovered: number;
  extracted: number;
  reused: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Group a bank's existing scanned offers by normalized sourceUrl (the reuse source for unchanged pages).
export function groupOffersBySourceUrl(offers: ScannedOffer[]): Map<string, ScannedOffer[]> {
  const map = new Map<string, ScannedOffer[]>();
  for (const offer of offers) {
    let key: string;
    try {
      key = normalizeUrl(offer.sourceUrl);
    } catch {
      continue;
    }
    const arr = map.get(key) ?? [];
    arr.push(offer);
    map.set(key, arr);
  }
  return map;
}

// Crawl a bank's detail pages, extracting only new/changed pages (hash-gated) and reusing the rest.
export async function refreshCrawlBank(
  entry: BankRegistryEntry,
  snapshot: ScannedOffer[],
  prevHashes: Record<string, string>,
  reviewDateIso: string,
  deps: CrawlExtractDeps,
): Promise<CrawlExtractResult> {
  const throttleMs = deps.throttleMs ?? 0;
  const maxExtractions = deps.maxExtractions ?? Infinity;
  const base: CrawlExtractResult = {
    ok: false, offers: [], detailHashes: prevHashes,
    inputTokens: 0, outputTokens: 0, discovered: 0, extracted: 0, reused: 0,
  };

  const disc = await deps.discover();
  if (!disc.ok || !disc.urls || disc.urls.length === 0) {
    return { ...base, error: disc.error ?? "no detail urls discovered" };
  }

  const byUrl = groupOffersBySourceUrl(snapshot);
  const nextHashes: Record<string, string> = {};
  const collected: ScannedOffer[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let extracted = 0;
  let reused = 0;

  const keepPrior = (url: string, prior: ScannedOffer[]): void => {
    if (prior.length === 0) return;
    collected.push(...prior);
    reused += prior.length;
    if (prevHashes[url] !== undefined) nextHashes[url] = prevHashes[url];
  };

  for (const rawUrl of disc.urls) {
    const url = normalizeUrl(rawUrl);
    const prior = byUrl.get(url) ?? [];

    const fetched = await deps.fetchDetail(url);
    if (!fetched.ok || !fetched.strippedText) {
      keepPrior(url, prior);
      continue;
    }
    const hash = fetched.contentHash ?? "";

    if (prevHashes[url] !== undefined && prevHashes[url] === hash && prior.length > 0) {
      collected.push(...prior.map((o) => ({ ...o, lastReviewedAt: reviewDateIso })));
      reused += prior.length;
      nextHashes[url] = hash;
      continue;
    }

    if (extracted >= maxExtractions) {
      keepPrior(url, prior);
      continue;
    }

    if (throttleMs > 0) await sleep(throttleMs);
    const ex = await deps.extract(url, fetched.strippedText);
    inputTokens += ex.inputTokens;
    outputTokens += ex.outputTokens;
    extracted += 1;
    for (const offer of ex.offers) collected.push({ ...offer, sourceUrl: url });
    nextHashes[url] = hash;
  }

  const dedup = new Map<string, ScannedOffer>();
  for (const offer of collected) dedup.set(offer.id, offer);

  return {
    ok: true, offers: [...dedup.values()], detailHashes: nextHashes,
    inputTokens, outputTokens, discovered: disc.urls.length, extracted, reused,
  };
}
```

- [ ] **Step 4: Run test + lint**

Run: `npx vitest run tests/ingest/crawl-extract.test.ts && npm run lint`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add lib/ingest/crawlExtract.ts tests/ingest/crawl-extract.test.ts
git commit -m "feat(crawl): add refreshCrawlBank hash-gated detail extraction"
```

---

### Task 8: Orchestrator wiring + env controls

**Files:**
- Modify: `scripts/refresh.ts`
- Test: covered by the unit suites above + the live validation in Task 9 (the script has no unit test today; keep that convention).

**Interfaces:**
- Consumes: `discoverDetailUrls`, `fetchRawHtml`, `refreshCrawlBank`, `extractOffers`, `fetchAndStrip`.
- Produces: a crawl branch in the per-bank loop; `RefreshState.banks[id].details`; `ONLY_BANKS` and `MAX_DETAILS_PER_RUN` env controls.

- [ ] **Step 1: Add imports**

At the top of `scripts/refresh.ts`, add:

```ts
import { discoverDetailUrls } from "@/lib/ingest/crawlBank";
import { fetchAndStrip, hashContent, fetchRawHtml } from "@/lib/ingest/fetchAndStrip";
import { refreshCrawlBank } from "@/lib/ingest/crawlExtract";
```

(Replace the existing `fetchAndStrip` import line so `fetchRawHtml` is included.)

- [ ] **Step 2: Widen the state type**

Change the `RefreshState` interface:

```ts
interface RefreshState {
  lastRunAt: string;
  banks: Record<string, { hash?: string; lastUpdatedAt: string; details?: Record<string, string> }>;
}
```

- [ ] **Step 3: Add env controls in `main()` (next to `sanityOverride`)**

```ts
  const onlyBanks = new Set((process.env.ONLY_BANKS ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const maxDetails = Number(process.env.MAX_DETAILS_PER_RUN ?? "") || Infinity;
```

- [ ] **Step 4: Add the ONLY_BANKS filter at the top of the `for (const entry of bankRegistry)` loop**

Immediately inside the loop, before the `sourceUrls` line:

```ts
    if (onlyBanks.size > 0 && !onlyBanks.has(entry.bankId)) continue;
```

- [ ] **Step 5: Add the crawl branch**

Inside the `try {` block, **before** "Gate 1: fetch + strip every source", insert:

```ts
      // Crawl branch: a source with a `crawl` recipe is walked to its detail pages, each hash-gated
      // so only new/changed pages reach Claude. Keeps existing rows on any discovery/fetch failure.
      const crawlSource = entry.sources.find((s) => s.crawl);
      if (crawlSource?.crawl) {
        if (!client) {
          report.banks[entry.bankId] = { status: "deferred", sources: sourceUrls, message: "ANTHROPIC_API_KEY not set" };
          continue;
        }
        const recipe = crawlSource.crawl;
        const seedUrls = entry.sources.filter((s) => s.crawl).map((s) => s.url);
        const snapshot = catalog.offers.filter((o) => o.bankId === entry.bankId);
        const prevHashes = state.banks[entry.bankId]?.details ?? {};
        const result = await refreshCrawlBank(entry, snapshot, prevHashes, reviewDateIso, {
          discover: () => discoverDetailUrls(seedUrls, recipe, fetchRawHtml),
          fetchDetail: (url) => fetchAndStrip({ url, type: "static_html" }),
          extract: async (sourceUrl, strippedText) => {
            const ex = await extractOffers({ entry, sourceUrl, strippedText }, client, reviewDateIso);
            return { offers: ex.offers, inputTokens: ex.inputTokens, outputTokens: ex.outputTokens };
          },
          throttleMs: 300,
          maxExtractions: maxDetails,
        });
        report.tokensUsed.input += result.inputTokens;
        report.tokensUsed.output += result.outputTokens;
        if (!result.ok) {
          report.banks[entry.bankId] = { status: "fetch-failed", sources: sourceUrls, message: result.error };
          continue;
        }
        const activeOffers = result.offers.filter((o) => isActiveOffer(o.validUntil, reviewDateIso));
        if (activeOffers.length === 0) {
          report.banks[entry.bankId] = { status: "extract-failed", sources: sourceUrls, message: "crawl returned no active offers" };
          continue;
        }
        const currentCount = countBankOffers(seed, entry);
        const dedupedOffers = dedupeById(activeOffers);
        const newCount = dedupedOffers.length;
        if (!sanityOverride.has(entry.bankId) && currentCount >= SANITY_MIN_BASELINE && newCount <= SANITY_COLLAPSE_FLOOR) {
          report.banks[entry.bankId] = {
            status: "sanity-rejected",
            sources: sourceUrls,
            message: `catalog collapsed: scraped ${newCount} offers vs ${currentCount} stored (likely a broken scrape); kept existing rows. Re-run with SANITY_OVERRIDE=${entry.bankId} to accept.`,
          };
          continue;
        }
        ({ seed, catalog } = importBankOffers(entry, dedupedOffers, reviewDateIso, seed, catalog));
        state.banks[entry.bankId] = { lastUpdatedAt: reviewDateIso, details: result.detailHashes };
        report.banks[entry.bankId] = { status: "updated", sources: sourceUrls, offersWritten: newCount };
        continue;
      }
```

- [ ] **Step 6: Run the full suite + lint**

Run: `npx vitest run && npm run lint`
Expected: PASS, no type errors (existing tests stay green; `hash?` optional change compiles).

- [ ] **Step 7: Commit (checkpoint)**

```bash
git add scripts/refresh.ts
git commit -m "feat(refresh): route crawl banks through hash-gated detail extraction"
```

---

### Task 9: Live validation (People's reference)

**Files:** none (operational verification). Requires `ANTHROPIC_API_KEY` in `.env.local`.

- [ ] **Step 1: Back up current data (so a diff is easy to inspect)**

```bash
cp data/seed.json /tmp/seed.before.json
```

- [ ] **Step 2: Run a People's-only crawl**

```bash
set -a; source .env.local; set +a
ONLY_BANKS=peoples-bank npm run refresh:fresh
```

Expected console: `Refresh complete. {"updated":1} ... tokens: {...}` with a non-trivial output token count (≈190 extractions on the first run).

- [ ] **Step 3: Verify quality (counts, deep links, rich descriptions, expiry)**

```bash
node -e '
const s=require("./data/seed.json");
const ids=new Set(s.cards.filter(c=>c.bankId==="peoples-bank").map(c=>c.id));
const o=s.offers.filter(x=>ids.has(x.cardId));
console.log("count:",o.length);
console.log("all deep-linked:",o.every(x=>/\/promotion\/[a-z0-9-]+\//.test(x.sourceUrl)));
console.log("avg desc len:",Math.round(o.reduce((a,x)=>a+(x.description||"").length,0)/o.length));
console.log("with validUntil:",o.filter(x=>x.validUntil).length);
console.log("sample:",JSON.stringify(o[0],null,1));
'
```

Expected: count in the ~150–200 range; `all deep-linked: true`; average description length clearly above the old listing-only text; a healthy share with `validUntil`.

- [ ] **Step 4: Verify hash-gating (token safety) — second run makes zero Claude calls**

```bash
set -a; source .env.local; set +a
ONLY_BANKS=peoples-bank npm run refresh:fresh
node -e 'const r=require("./data/refresh-report.json");console.log("tokens:",JSON.stringify(r.tokensUsed));console.log("status:",r.banks["peoples-bank"].status)'
```

Expected: `tokens: {"input":0,"output":0}` (every detail page reused), `status: "unchanged"` **or** `updated` with 0 tokens. `git diff --stat data/seed.json` shows no meaningful churn.

- [ ] **Step 5: Verify broken-crawl safety (keeps rows, zero tokens, fails run)**

Temporarily break the recipe (point the detail matcher at a path that exists nowhere), then run:

```bash
# In lib/sources/bankRegistry.ts People's crawl, set detailMatch to "/__nope__/" (temporary)
set -a; source .env.local; set +a
ONLY_BANKS=peoples-bank npm run refresh:fresh; echo "exit=$?"
node -e 'const r=require("./data/refresh-report.json");console.log(r.banks["peoples-bank"])'
```

Expected: `status: "fetch-failed"`, `exit=1`, People's offers in `data/seed.json` unchanged. **Revert the temporary `detailMatch` edit afterward.**

- [ ] **Step 6: Restore baseline if needed**

If validation left unwanted changes (e.g., the broken-crawl test or a partial run), restore:

```bash
cp /tmp/seed.before.json data/seed.json
```

Re-run Step 2 once more to produce the final good data when ready to keep it.

- [ ] **Step 7: Commit data (checkpoint — only when the user authorizes)**

```bash
git add data/seed.json data/scanned-offers.json data/refresh-state.json data/refresh-report.json
git commit -m "chore(data): People's Bank deep-crawl refresh"
```

---

## Self-Review

**Spec coverage:**
- Root-cause fix (crawl depth + link preservation) → Tasks 3–5, 7–8. ✓
- Per-bank `crawl` recipe (`hops`/`detailMatch`/`render`) → Task 4 (types) + Task 6 (People's). ✓
- Per-detail-URL hash-gate + reuse → Task 7 (`refreshCrawlBank`) + Task 8 (state `details`). ✓
- Deep link as `sourceUrl`/`termsLink` → Task 7 (forces `sourceUrl = url`). ✓
- Token safety (broken crawl = 0 calls, rows kept) → Task 7 tests + Task 9 Step 5. ✓
- Sanity gate unchanged → reused verbatim in Task 8. ✓
- Haiku model, one-constant swap → Task 1. ✓
- Cost control for first-run backfill → `MAX_DETAILS_PER_RUN` (Task 8) + `maxExtractions` (Task 7). ✓
- People's credit-only → hop matcher constrains `cardType=credit_card` (Tasks 4/6). ✓
- Validation plan (counts/deep links/terms; zero-call re-run; 404 safety) → Task 9. ✓
- `render: "dynamic"` is typed (Task 4) but not implemented this round — out of scope per spec (People's is static); other banks reuse it later. Noted, not a gap.

**Placeholder scan:** none — every code/test step has concrete content.

**Type consistency:** `CrawlRecipe`/`DiscoverResult`/`HtmlFetcher` defined in Task 4 and consumed by Tasks 6/8; `CrawlExtractDeps`/`CrawlExtractResult`/`refreshCrawlBank`/`groupOffersBySourceUrl` defined in Task 7 and consumed by Task 8; `EXTRACTION_MODEL` defined in Task 1. `fetchDetail` shape matches `FetchResult` from `fetchAndStrip`. `RefreshState.banks[id]` `hash` made optional consistently. ✓
