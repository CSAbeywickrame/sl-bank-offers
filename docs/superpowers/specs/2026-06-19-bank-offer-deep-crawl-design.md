# Deep-Crawl Offer Extraction — Design

**Date:** 2026-06-19
**Status:** Approved (design); pending implementation plan
**Reference bank:** People's Bank

## Problem

The unified weekly refresh (`scripts/refresh.ts` → `lib/ingest/fetchAndStrip.ts` →
`lib/ingest/extractWithClaude.ts`) fetches **one URL per source**, strips it to visible
text, and sends that to Claude. Two compounding defects gut data quality versus the old
Paperclip dataset still in `data/seed.json`:

1. **No crawl depth.** `fetchAndStrip` never enumerates the offer links on a listing page
   or visits the per-offer detail pages. Claude only sees thin listing text — no per-offer
   terms, expiry, location.
2. **Links discarded.** `stripHtml` uses `$("body").text()`, dropping every `href`. So even
   the listing page's own offer links never reach Claude; each offer's `sourceUrl` falls
   back to the listing URL (`extractWithClaude.ts:157`). Result: every "View at bank" button
   points at the generic offers page, not the specific promotion.

Verified live (People's Bank):
- `/special-offers/` is a 3-level tree. L1 links to **category** pages
  `/promotion-category/<cat>/?cardType=credit_card`; L2 category pages (static, HTTP 200)
  list all `/promotion/<slug>/` detail links (restaurants = 80, supermarkets = 4); L3 detail
  pages (static, ~1.3 KB) carry the rich offer: title, discount, `Validity: From <date> to
  <date>`, `Location`, T&C.
- The WordPress REST API is disabled (500). No feed shortcut; the tree is fully
  **static-crawlable** (no Playwright needed for People's).

## Goals

- Restore rich per-offer descriptions and **deep links** (each offer's `sourceUrl`/`termsLink`
  = its own detail page).
- Keep the unified-Claude maintainability win — **no per-bank DOM parsers**.
- Per-bank topology expressed as a few lines of **config**, not code ("separate logic per
  bank" without 12 brittle parsers).
- Token-safe by construction: a broken crawl spends **zero** Claude tokens and never wipes a
  bank's existing rows.
- Weekly cost near-zero after a one-time backfill.

## Non-goals

- Rewriting feed/PDF banks (sampath, standard-chartered) — untouched.
- People's debit-card offers — credit-card only this round (matches the registry card and the
  existing dataset). Debit is a later, additive change.
- Wiring every static bank in this spec — only the shared engine + People's reference.
  Other static banks (dfcc, seylan, commercial, ndb, boc, ntb, cargills, nsb) are onboarded
  afterward, one recipe each, reusing this engine.

## Architecture

A shared crawl engine driven by a per-bank **crawl recipe** in the registry, plus
**per-detail-URL hash-gating** so only changed/new detail pages reach Claude.

### 1. Registry: optional `crawl` block

```ts
interface CrawlRecipe {
  hops: string[];        // ordered regex matchers, index → intermediate pages (0+ hops)
  detailMatch: string;   // regex; matched hrefs are the detail pages to extract
  render?: "static" | "dynamic"; // page fetch mode for hop/detail fetches (default "static")
}
```

Added optionally to `RegistrySource` (or the entry). A source **without** `crawl` keeps
current behaviour (single-page Claude extract / feed mapper / PDF). People's recipe:

```ts
crawl: {
  hops: ["/promotion-category/"],
  detailMatch: "/promotion/[a-z0-9-]+/",  // excludes /promotion-category/
}
```

`render: "dynamic"` reuses the existing Playwright path for a JS-only level (e.g. pan-asia
later). People's is `"static"`.

### 2. Crawl engine — `lib/ingest/crawlBank.ts`

`discoverDetailUrls(source, crawl): Promise<{ ok, urls?, error? }>`

- Start from the source URL(s).
- For each hop matcher in order: fetch the current level's pages, collect `<a href>` matching
  the hop regex, resolve relative→absolute, keep on-site only, dedup → next level.
- After the last hop, collect hrefs matching `detailMatch` → the detail-URL set.
- Polite throttle (~250–500 ms) between fetches. Never throws — returns `{ ok:false, error }`.
- A link-preserving parse (cheerio on raw HTML, read `href` before stripping).

For People's: L1 `/special-offers/` → category URLs (`?cardType=credit_card` retained) →
L2 category pages → `/promotion/<slug>/` detail URLs (union across categories, deduped).

### 3. Per-detail extraction + hash-gate (token-safety core)

In the orchestrator, for a crawl bank:

1. `discoverDetailUrls` → set **D**. If `!ok` or `D` is empty → keep existing rows, flag
   `fetch-failed`, **zero Claude calls**.
2. Snapshot the bank's existing offers into `Map<normalizedSourceUrl, offer>` **before**
   replacing rows (reuse source).
3. For each `url ∈ D`: fetch detail (prefer `<main>`/article region, else body) + strip +
   hash.
   - `state.details[url] === hash` **and** a snapshot offer exists for `url` → **reuse** it
     (no Claude).
   - else → Claude extracts that one page; `sourceUrl` = `termsLink` = `url`; set
     `state.details[url] = hash`.
4. Bank's new offer set = reused ∪ freshly-extracted **for the current D only**. URLs absent
   from D drop out → correct add/remove semantics.
5. Existing active-offer filter, dedupe, and **collapse-floor sanity gate** apply unchanged.
6. `importBankOffers` replaces the bank's rows.

URL normalization for keys/dedup: lowercase host, single trailing slash, strip fragment
(detail URLs carry no query). ID stability is preserved — `buildId` already keys on
`bankId|title|sourceUrl`, and the deep `sourceUrl` is stable per promotion.

### 3a. Model

Extraction uses **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) — detail pages are tiny
(~1.3 KB) and the task is simple structured extraction, so Haiku is enough and cheaper than
Sonnet. The model is a **single constant** in `extractWithClaude.ts`; if extraction quality
regresses on validation, switch back to `claude-sonnet-4-6` (one-line change). Validate
output_config/json-schema structured output and `thinking: disabled` behave identically on
Haiku during the People's reference run; revert to Sonnet if any incompatibility appears.

### 4. State schema — `data/refresh-state.json`

Per crawl bank, add a per-URL hash map alongside the existing combined hash:

```jsonc
"peoples-bank": {
  "lastUpdatedAt": "…",
  "details": { "https://www.peoplesbank.lk/promotion/keells-25-off-credit/": "<sha1>", … }
}
```

Non-crawl banks keep their current `{ hash, lastUpdatedAt }` shape.

## Data flow

```
registry(crawl) ─▶ discoverDetailUrls ─▶ D (detail URLs)
                                          │
              snapshot existing offers ───┤
                                          ▼
                 per url: fetch+strip+hash ─▶ unchanged? ─yes▶ reuse offer (FREE)
                                          └─ new/changed ─────▶ Claude (1 tiny call)
                                                                 sourceUrl = detail URL
                                          ▼
              reused ∪ extracted ─▶ active filter ─▶ dedupe ─▶ sanity gate ─▶ importBankOffers
```

## Error handling & token safety

| Condition | Behaviour | Claude calls |
|---|---|---|
| index/hop/detail fetch fails | keep existing rows, `fetch-failed` | 0 |
| `D` empty (broken crawl) | keep existing rows, `fetch-failed` | 0 |
| detail page unchanged (hash match) | reuse stored offer | 0 |
| detail page new/changed | extract that one page | 1 (small) |
| scraped count collapses ≤ floor vs baseline | sanity-reject, keep rows, fail run | already spent on changed pages only |

A single detail-page failure is isolated (try/catch per URL): that offer is skipped, the rest
proceed. Per-bank isolation and the run-level failure surfacing are unchanged.

## Cost

People's backfill ≈ ~190 tiny calls (~1.3 KB each) on **Haiku 4.5**, one-time well under $1.
Subsequent weekly runs extract only new/changed promotions → cents. Other banks add to the
one-time backfill, then near-zero. HTTP volume (≈190 detail fetches/bank/week) is mitigated by
throttling.

## Validation (People's reference)

- Detail-URL discovery count is in the same ballpark as the old 190 rows (allow drift for
  genuinely expired/added promos).
- Spot-check ≥5 offers: `sourceUrl` is the `/promotion/<slug>/` deep link; `description`
  carries detail-page terms; `validUntil` parsed from `Validity: … to <date>`.
- Re-run with no source change → **zero** Claude calls, byte-stable `seed.json` (hash-gate +
  reuse proven).
- Point a category URL at a 404 → `fetch-failed`, rows intact, zero calls, run exits non-zero.
- `npm run lint` (tsc) and `npm test` (vitest) green.

## Rollout

1. Build the crawl engine + per-detail hash-gate/reuse + state schema change.
2. Wire People's recipe; validate as above against the existing dataset.
3. Onboard the other static banks one recipe at a time (discover each topology live; most are
   flat listing→detail, `hops: []`).
4. pan-asia stays `render: "dynamic"`; sampath/standard-chartered unchanged.

## Risks & mitigations

- **Topology drift** (a bank restructures its category/detail paths) → surfaces as
  `fetch-failed`/empty-D in `refresh-report.json` with rows preserved; fix the one-line recipe.
- **Detail-page noise** (nav/footer/accessibility toolbar) inflating hashes/tokens → prefer the
  main-content region when present; fall back to body.
- **Politeness / rate limits** → throttle between fetches, descriptive UA, single retry (reuse
  existing `fetchWithTimeout`).
- **First-run cost spike** → bounded by `MAX_BANKS_PER_RUN`; People's-only this spec keeps the
  initial backfill small.

## Constraints

- Implementation via the `atomic-code-writer` agent; code review after each piece (per
  CLAUDE.md).
- No commits unless explicitly requested.
- `ANTHROPIC_API_KEY` stays in gitignored `.env.local`; never in chat or git.
