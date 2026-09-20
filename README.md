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

The `:root` block of **`app/globals.css`** is the full token set: raw colour scales,
semantic aliases (`--text-*`, `--surface-*`, `--border-*`, `--action-*`, `--badge-*`,
`--hero-*`, `--offer-rule`), the type scale (`--fs-*`, `--lh-*`, `--ls-*`, `--fw-*`),
the 4px spacing scale (`--space-*`), radii, shadows, layout and control heights, and a
`[data-theme="dark"]` block that re-points only the semantic aliases. **`tailwind.config.ts`**
mirrors the colour scales, radii and shadows so the matching utility classes exist.

Prefer the **semantic** token in components — `bg-(--action-primary-bg)`,
`text-(--text-muted)`, `border-(--border-subtle)` — over a raw scale step
(`bg-navy-900`), so a theme swap only has to re-point the aliases. Never add new
hardcoded hex.

Hanken Grotesk is loaded with `next/font` in `app/layout.tsx`, which self-hosts it and
exposes it as `--font-hanken-grotesk`; `--font-sans` points at that variable, so
components only ever read one font token. Do not add a Google Fonts `@import`.

Shared primitives live in **`components/ui/`**: `button.tsx` (`buttonClasses()` shared by
`<button>`, `<Link>` and `<a>`), `badge.tsx`, `field.tsx` (`Input`, `Select`, `fieldClass`,
`labelClass`), `icon.tsx` and `popover.tsx`.

**Source of truth:** `design-spec/SL-Card-Offers-DesignSystem-export.md`.

> Note: `design-spec/README.md`, `design-spec/styles.css`, the loose
> `design-spec/tokens/*.css` and `design-spec/ui_kits/` describe an earlier
> **Emerald & Gold** (forest-green `#08271c`, Inter) split. Those are **stale** and have
> been superseded by the export doc above — do not use them as reference. They are the
> only remaining `--brand-forest` / forest-green source in the repo; re-export the
> folder from the design project to clear it.
