# Handoff — E10 "Site quality" epic

Pick this up cold. Everything you need to resume is here or reachable from here.

**Last updated:** 2026-08-30, after E10-T11 shipped to production.

## Where to look first

| What | Where |
|---|---|
| Task board, statuses, per-task decisions | easyprm MCP — `get_status`, then `get_task E10-T13` etc. Task comments hold the real detail. |
| Approved plan (architecture, all 17 tasks) | `~/.claude/plans/i-found-a-new-fizzy-sutton.md` |
| Cross-session facts | memory dir — `merchant-identity-outlet-level`, `model-routing-opus-fable`, `framing-own-quality-not-competitor` |

## State as of this handoff

`main` and `develop` are in sync — zero code difference. Production carries everything through T11.

**Done and live (7 of 17):** T0.1 dead-pipeline deletion · T1.1 schema + enrichment · T1.2 catalog migration · T1.3 taxonomy lock · T3.1 design tokens · T2.1 extraction schema v2 · T2.5 merchant registry · T3.2 card + detail v2.

**Catalog:** 2,617 offers, 13 verticals, 1,383 merchants (190 at more than one bank).

**Verification baseline:** `npm run lint`, `npm test` (318 passing), `npm run build` all green on develop. If a number below is lower than what you see, someone added tests — fine. If it is *higher*, something regressed.

## How this project works

Read these before changing anything; each was learned the hard way.

**Per task:** branch off `develop` → implement → `npm run lint && npm test && npm run build` → `/code-review high` → fix findings → commit → PR into `develop` → merge when green. Never commit without being asked. The user pushes `develop` → `main` themselves.

**The weekly refresh is the thing you can break.** `.github/workflows/refresh.yml`, Mondays 02:00 UTC, runs off `main`. It rebuilds every bank's rows from scratch. Two consequences that have already bitten:

- A **feed bank** (HNB, Sampath — `lib/ingest/feedMappers.ts`) is rebuilt deterministically each run, so anything derived rather than stored gets re-derived. `importBankOffers` deliberately carries the stored `category` forward for those banks; without it, a refresh silently reverted 593 of 915 rows.
- A parser added to `lib/ingest/enrich.ts` reaches existing rows **only** when their bank is next imported. Backfill with `npx tsx scripts/reenrich-catalog.ts` — pure regex, no API cost, fills blanks only.

**Data and code must ship together.** The category enum and the stored data have to agree; `assertScannedOffer` rejects an unknown category at load time, which takes down the whole site rather than one row. Never merge an enum change without the data change.

**`toOffer` in `lib/offers/repository.ts` copies field by field.** A new enrichment field missing there type-checks, passes every test, and is invisible in the UI forever. `tests/offers/repository-enrichment.test.ts` guards this — if you add a field to `OfferEnrichment`, add it there too.

**Verify by rendering, not by building.** `npm run build` passing means nothing about whether a value reaches the page. Serve it and look:
```
npm run build && (npx next start -p 3999 &) && sleep 12
curl -s http://localhost:3999/offers/<id> | grep -oE "<what you expect>"
pkill -f "next start -p 3999"
```
That is how the `installmentMonths` bug was caught — stored on 897 offers, rendered on none.

**Cost and limits.** The Claude Code plan hit its monthly cap repeatedly; subagent spawns fail with "monthly spend limit", so work runs in the main session. That limit is **separate** from the project's own `ANTHROPIC_API_KEY` in `.env.local`, which the scrape and migration scripts bill to — a long-running script survives an agent dying. Check `pgrep -f <script>` before assuming work stopped.

## Remaining tasks, in the order I would take them

**T13 — `/merchants` and `/merchants/[slug]`** (next). The registry (`lib/offers/merchants.ts`) and `components/RelatedOffers.tsx` already do the work; this is routes, `generateStaticParams`, `ItemList` JSON-LD, alias slugs redirecting to canonical, nav and sitemap. Split the index into "at more than one bank" and the rest.

**T3.3 — filters v2.** Min discount, offer type, day of week, validity window, date added (`firstSeenAt` exists for this), network/type/tier. One match function per dimension in `lib/offers/filter.ts`, new controls behind a "More filters" disclosure, `biggest-discount` sort. **Carry-over:** three redirects in `next.config.ts` are deliberately `permanent: false` because nothing reads `?type=` yet — flip them to `permanent: true` in this task.

**T2.2 — image pipeline.** Add `sharp`; `lib/ingest/images.ts` with `prepareForVision` (downscale before the vision call — this is the fix for the peoples-bank "Could not process image" 400s), `saveThumbnail` (content-hash webp in `public/offer-images/`), `sweepOrphans`. Also add a relevance filter to `discoverAssetUrls` (it currently ingests staff portraits) and cache failed assets so a bad file stops burning an API call every run.

**T2.3 — feed mapper upgrades.** Sampath's `short_discount` → `discountPct`, its tabs → verticals, `visa_offers` → networks; HNB `cardType` → `cardTypes`.

**T2.4 — backfill.** `FORCE_EXTRACT=1` flag on `scripts/refresh.ts`, then per-bank runs. Costs real API credit; the user tops it up.

**T3.5 banks surfaces · T4.1 about page · T4.2 SEO rebrand · T4.3 refresh dry run.** T4.2 depends on T13 for the merchant count.

## Things worth not relearning

- **Merchants never auto-merge.** Identity is outlet-level: "Jetwing Beach - The Deck" is a restaurant inside "Jetwing Beach", and merging them would claim a dining discount covers a room booking. Only `data/merchant-aliases.json` collapses names; `group` is same-brand and never affects counts. Grow the table from `npx tsx scripts/merchant-fragmentation.ts`, which proposes nothing on purpose.
- **The headline is not always a percentage.** Only 60% of offers have `discountPct`; a third are instalment plans where the term is the offer. `lib/offers/highlight.ts` decides this once for card and detail alike.
- **Category is what is bought; `offerType` is how it pays out.** An interest-free plan at an electronics shop is `electronics` + `installment`. Rule order in `lib/ingest/categorize.ts` encodes real cases: dining before hotels (a hotel restaurant is a meal out), online last (it describes how you buy).
- **Parsers are conservative by design.** A blank the UI hides beats a wrong promise to a cardholder. Every guard exists because live data broke without it: `visa` matched card boilerplate, `Book now` matched books, a bare "maximum" matched transaction ceilings and published a Rs. 1 discount cap on 84 offers.
- **Review by measuring against `data/scanned-offers.json`**, not by reasoning. Every serious bug in this epic was found that way and missed by the test suite.
