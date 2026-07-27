# SL Card Offers

Sri Lanka's credit-card offers aggregator — a filterable grid of live bank promotions
scraped from official bank sources, in one searchable place. Live at
[slcardoffers.com](https://slcardoffers.com).

## Stack

- **Next.js 16** (App Router) + **React 19**
- **Tailwind CSS v4** (design tokens via `@config "../tailwind.config.ts"` in `app/globals.css`)
- **TypeScript**
- **Hanken Grotesk** (Google Fonts) as the product typeface
- Offer ingestion pipeline (`lib/ingest`, `scripts/`) using Cheerio + the Anthropic SDK
- Deployed on Vercel (`@vercel/analytics`)

## Local development

```bash
npm install
npm run dev          # start the dev server on http://localhost:3000
npm run build        # production build
npm run start        # serve the production build
npm run lint         # next typegen + tsc --noEmit
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end tests (Playwright)
```

## Project layout

| Path | Purpose |
|---|---|
| `app/` | App Router pages: home (offer grid), `banks/`, `categories/`, `offers/[offerId]`, plus `manifest.ts`, `sitemap.ts`, `robots.ts`, icons |
| `components/` | UI components. Reusable primitives live in `components/ui/` (`Button`, `Badge`); shared pieces: `OfferCard`, `FilterPanel`, `Header`, `Footer`, `StatTile`, `BankCard`, `AdSlot`, `EmptyState` |
| `lib/offers/` | Offer domain: types, repository, filtering, sorting, pagination, per-bank importers |
| `lib/ingest/` | Scraping/ingestion: crawl, extract (HTML + Claude), categorize, persist |
| `scripts/` | Offer refresh + sync entry points (`npm run refresh`, `refresh:fresh`, `sync:scanned`) |
| `data/` | Scraped offer data (seed/source JSON) |
| `design-spec/` | Design-system handoff (see below) |
| `docs/` | Data schema + historical plans/specs |

## Offer data pipeline

Offers are refreshed by the scripts in `scripts/`, which drive `lib/ingest` (fetch →
strip → extract → categorize → persist) and the per-bank importers in `lib/offers`.
Each offer records a `lastCheckedAt` date; the UI surfaces it so users can judge
freshness, and every listing links back to the official bank source.

## Design system — "Navy & Emerald"

The visual language is **Navy & Emerald**:

- **Navy** (`#0b1f33` / `#0d2137`) — hero band, footer, and the primary "View details" CTA.
- **Emerald** (`#047857`) — the action colour everywhere: buttons, links, focus rings.
- **Gold** (`#c99a2e`) — a small rewards/premium accent (premium badge, logo chip) only —
  never small body text.
- **Neutrals** — a faintly green-tinted gray ramp.
- **Type** — Hanken Grotesk across the whole product.

Tokens live in **`tailwind.config.ts`** (color scales, radii, shadows) and the `:root`
block of **`app/globals.css`** (semantic aliases: `--action-primary-bg`, `--offer-rule`,
`--badge-*` tones, `--hero-*`, etc.). Components consume tokens via Tailwind utility
classes (`bg-navy-900`, `text-emerald-700`) or `var(--token)` arbitrary values — avoid
new hardcoded hex.

**Source of truth:** `design-spec/SL-Card-Offers-DesignSystem-export.md`.

> Note: `design-spec/README.md` and the loose `design-spec/tokens/*.css` describe an
> earlier **Emerald & Gold** (forest-green, Inter) split. Those are **stale** and have
> been superseded by the export doc above — do not use them as reference.
