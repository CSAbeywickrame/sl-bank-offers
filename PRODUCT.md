# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Sri Lankan credit cardholders **browsing to plan ahead** — exploring at leisure what is
worth using this month, where to eat this weekend, which of their cards earns the most
where. They scan and compare, and they are willing to refine filters to get there. They
typically hold cards from two to four banks, so "which of my cards" is a standing question
rather than a one-off.

A second, lighter audience arrives from search on a specific merchant or category and
leaves once they have the answer.

## Product Purpose

Aggregate live credit-card promotions from Sri Lankan banks into one filterable, searchable
place, so a cardholder can see every offer their cards qualify for without visiting a dozen
bank websites. Success is a visitor narrowing thousands of offers down to the handful that
apply to them, and trusting the result enough to act on it.

## Positioning

Offers are scraped directly from official bank sources by an ingestion pipeline, not
hand-curated or user-submitted. Every listing links back to the bank's own page and records
a `lastCheckedAt` date that the UI surfaces, so freshness is visible rather than claimed. The
product's honesty about staleness is the thing a hand-maintained competitor cannot copy.

## Operating Context

- Live at slcardoffers.com.
- Catalog scale: 14 banks, 20 cards, 9 offer categories, ~2,600 active offers.
- Offers refresh on a recurring pipeline (`scripts/refresh*`, `lib/ingest`): fetch → strip →
  extract → categorize → persist. Source types vary per bank (JSON feed, offers page,
  internal pages, images/PDFs), and individual banks can fail a refresh.
- Routes: home (offer grid + filters), `/banks`, `/banks/[bankId]`, `/categories`,
  `/categories/[category]`, `/offers/[offerId]`.
- Offers always carry a disclaimer to verify details at the official bank source before use.

## Capabilities and Constraints

- **Filter state lives entirely in the URL** (`?bank=&card=&category=&search=&sort=&page=`),
  parsed server-side; filtering and sorting happen in-memory per request. This makes every
  filtered view shareable and bookmarkable, and it is the mechanism any new filter feature
  must go through.
- Filter dimensions: bank (multi), card (single, scoped to selected banks), category (multi),
  free-text search, sort (relevance / newest / expiring-soon), pagination.
- `/banks/[bankId]` and `/categories/[category]` **lock** one filter dimension; UI must
  respect locked dimensions rather than fighting them.
- Next.js 16 App Router, React 19, Tailwind v4, TypeScript. Deployed on Vercel.
- **No state-management library, no form library, no component library.** Radix/shadcn/
  headlessui are absent by choice; primitives are hand-rolled in `components/ui/`.
- No accounts and no backend for user data. Personalization is `localStorage` only, under the
  `cardcompass:` key namespace.
- Bank and card IDs come from a static seed and can disappear between refreshes, so anything
  that persists an ID must tolerate it going missing.

## Brand Commitments

- Name: **SL Card Offers**.
- **"Navy & Emerald"** design system is binding and documented: Navy (`#0b1f33`) for the hero
  band, footer, and primary CTA; Emerald (`#047857`) as the action colour for buttons, links,
  and focus rings; Gold (`#c99a2e`) as a small rewards/premium accent only, never small body
  text; a faintly green-tinted neutral ramp.
- Typeface: **Hanken Grotesk** across the entire product.
- Tokens are authoritative in `tailwind.config.ts` and the `:root` block of `app/globals.css`
  (semantic aliases such as `--action-primary-bg`, `--border-default`, `--offer-rule`).
- Signature detail: the navy → emerald top rule on offer cards (`--offer-rule`).

## Evidence on Hand

- Real scraped offer data in `data/seed.json` (~2,600 offers across 14 banks).
- Design-system handoff in `design-spec/SL-Card-Offers-DesignSystem-export.md`.
- Data schema documented in `docs/data-schema.md`.
- No testimonials, user counts, press, or partnership claims exist. Future work must not
  fabricate them — the banks are scraped sources, not partners, and must never be presented
  as endorsing the product.

## Product Principles

1. **The user's cards are the lens.** Thousands of offers are noise until narrowed to the two
   to four banks someone actually holds.
2. **Freshness is visible, never implied.** Surface when an offer was last checked; link to
   the bank source rather than asking for trust.
3. **Every view is a URL.** Shareable, bookmarkable state is the product's spine, not an
   implementation detail.
4. **Hand-rolled and dependency-light.** New UI extends the existing primitives rather than
   importing a component library.
5. **Degrade honestly.** Banks fail refreshes and IDs vanish; the interface should say so
   plainly instead of showing an empty result with no explanation.

## Accessibility & Inclusion

No product-specific standard has been established. Existing components do implement keyboard
dismissal and focus return on popovers and `aria-expanded` on disclosure controls; that floor
should not regress.
