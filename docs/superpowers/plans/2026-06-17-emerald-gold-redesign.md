# Emerald & Gold Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all teal/slate Tailwind colour classes across the Next.js app with the Emerald & Gold design-system tokens, matching a precise design spec without touching any data-fetching, routing, or JSON-LD logic.

**Architecture:** Pure visual layer changes — no new files, no new abstractions, no routing changes. Each task owns exactly one file. Server components (page.tsx files) must use Tailwind group-hover or CSS-variable classes instead of JS event handlers; client components (FilterPanel, OfferCard) may use `onMouseEnter`/`onMouseLeave` because they are already `"use client"` or need to become so.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS v4, TypeScript, Inter variable font (Google Fonts), inline React style props for design-token values outside the Tailwind scale.

---

## File Map

| File | What changes |
|---|---|
| `tailwind.config.ts` | Extend theme: `forest`, `emerald`, `gold`, `neutral` colours; custom border-radii; custom shadows |
| `app/globals.css` | CSS custom properties for all design tokens; updated body/focus styles |
| `components/Header.tsx` | Border colour, nav link colours |
| `components/Footer.tsx` | Forest bg, gold gradient rule, gold/white text |
| `components/OfferCard.tsx` | Full redesign — top rule, badge colours, validity grid, CTA buttons (client component, so JS hover OK) |
| `components/EmptyState.tsx` | Dashed border, icon bg, CTA button colour |
| `components/FilterPanel.tsx` | Already `"use client"` — select/input border, label colours, badge, search button |
| `app/page.tsx` | Hero section only — forest bg, gold eyebrow pill, h1 highlight, stat panels |
| `app/banks/page.tsx` | Header section + bank card links (server component — Tailwind hover only) |
| `app/offers/[offerId]/page.tsx` | Back link, dark hero panel, details card, sidebar, CTA buttons (server component — Tailwind hover only) |

---

## Task 1: Tailwind config — extend theme with design tokens

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Open and verify current config**

Current content (confirmed): extends `{}`, no custom colours, no custom radius/shadow.

- [ ] **Step 2: Replace the entire file with the design-token config**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./pages/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: "#08271c",
        emerald: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#03281d",
        },
        gold: {
          300: "#e1c46e",
          400: "#d4af5f",
          500: "#c99a2e",
          600: "#a87d1f",
          800: "#5f4510",
        },
        neutral: {
          50: "#f4f9f6",
          100: "#e9f1ec",
          200: "#dde7e1",
          300: "#c4d3cb",
          400: "#95a89e",
          500: "#6a7d73",
          600: "#51635a",
          700: "#3b4a43",
          800: "#25322c",
          900: "#16201b",
        },
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        pill: "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgb(15 23 42 / 5%)",
        md: "0 4px 12px -2px rgb(15 23 42 / 10%), 0 2px 6px -2px rgb(15 23 42 / 6%)",
        lg: "0 12px 28px -6px rgb(15 23 42 / 16%)",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Verify TypeScript compiles (no errors in this file)**

Run: `cd /Users/chaithikaabeywickrame/Desktop/Chaithika/Business/BIZTool/bank-offers && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors related to `tailwind.config.ts`

---

## Task 2: globals.css — design token CSS custom properties

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the entire file**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
@import "tailwindcss";

:root {
  --bg-page: #f4f9f6;
  --surface-card: #ffffff;
  --surface-muted: #e9f1ec;
  --surface-inverse: #08271c;
  --text-strong: #16201b;
  --text-body: #3b4a43;
  --text-muted: #6a7d73;
  --text-faint: #95a89e;
  --text-link: #047857;
  --border-subtle: #dde7e1;
  --border-default: #c4d3cb;
  --border-focus: #10b981;
  --ring-focus: rgba(16, 185, 129, 0.32);
  --offer-rule: linear-gradient(90deg, #059669, #c99a2e);
}

* {
  box-sizing: border-box;
}

html {
  background: var(--bg-page);
  color: var(--text-strong);
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-strong);
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  text-decoration: none;
}

*:focus-visible {
  outline: 2px solid #10b981;
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.32);
}
```

---

## Task 3: Header.tsx — nav link colours and border

**Files:**
- Modify: `components/Header.tsx`

**Key constraint:** This is a server component. Use Tailwind `hover:` classes, not JS event handlers.

- [ ] **Step 1: Replace the entire file**

```tsx
import Link from "next/link";
import { siteName } from "@/lib/site-config";

// Site-wide sticky header with logo and main navigation
export function Header() {
  return (
    <header
      className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-sm"
      style={{ borderColor: "#dde7e1" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" aria-label={siteName}>
          <img
            src="/brand/sl-card-offers-logo.png"
            alt={siteName}
            className="block h-auto w-[140px] sm:w-[180px]"
          />
        </Link>

        <nav className="flex items-center gap-1" aria-label="Main navigation">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            style={{ color: "#3b4a43" }}
          >
            All Offers
          </Link>
          <Link
            href="/banks"
            className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            style={{ color: "#3b4a43" }}
          >
            Browse Banks
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

---

## Task 4: Footer.tsx — forest bg, gold gradient rule, gold/white text

**Files:**
- Modify: `components/Footer.tsx`

**Key constraint:** Server component — no JS event handlers needed here.

- [ ] **Step 1: Replace the entire file**

```tsx
// Site-wide footer with forest background and gold gradient top rule
export function Footer() {
  return (
    <footer className="mt-auto" style={{ background: "#08271c" }}>
      <div
        style={{
          height: "2px",
          background: "linear-gradient(90deg, #a87d1f, #e1c46e 50%, #a87d1f)",
        }}
      />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm font-semibold" style={{ color: "#e1c46e" }}>
            Sri Lankan Bank Card Offers
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            Data sourced from official bank websites · Verify all offers directly with your bank
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
```

---

## Task 5: OfferCard.tsx — full Emerald & Gold redesign

**Files:**
- Modify: `components/OfferCard.tsx`

**Key constraint:** This is a server component today. The spec requires `onMouseEnter`/`onMouseLeave` JS hover effects on the card, h2, and CTA buttons. Solution: add `"use client"` directive so hover handlers work. All data logic (formatDate, isExpiringSoon) remains identical; only styling changes.

Note: The spec changes `isExpiringSoon` threshold from 7 days to 14 days — apply that change.

- [ ] **Step 1: Replace the entire file**

```tsx
"use client";

import Link from "next/link";
import { getCategoryLabel } from "@/lib/offers/categories";
import type { Offer } from "@/lib/offers/types";

// Formats an ISO date string into a human-readable medium date, or "Not specified"
function formatDate(value: string | undefined): string {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not specified";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

// Returns true if the offer expires within the next 14 days
function isExpiringSoon(validUntil: string | undefined): boolean {
  if (!validUntil) return false;
  const date = new Date(validUntil);
  if (!Number.isFinite(date.getTime())) return false;
  const daysRemaining = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysRemaining >= 0 && daysRemaining <= 14;
}

// Offer card component displaying bank/category badges, title, description, validity, and CTA links
export function OfferCard({ offer }: { offer: Offer }) {
  const expiringSoon = isExpiringSoon(offer.validUntil);

  return (
    <article
      className="group flex h-full flex-col overflow-hidden transition-all duration-150"
      style={{
        background: "#ffffff",
        borderRadius: "12px",
        border: "1px solid #dde7e1",
        boxShadow: "0 1px 2px rgb(15 23 42 / 5%)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "#c4d3cb";
        el.style.boxShadow = "0 4px 12px -2px rgb(15 23 42 / 10%), 0 2px 6px -2px rgb(15 23 42 / 6%)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "#dde7e1";
        el.style.boxShadow = "0 1px 2px rgb(15 23 42 / 5%)";
      }}
    >
      {/* Top gradient rule */}
      <div
        style={{
          height: "4px",
          background: "linear-gradient(90deg, #059669, #c99a2e)",
          flexShrink: 0,
        }}
      />

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Bank / category / expiry badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: "#e3f1ea",
              color: "#065f46",
              boxShadow: "inset 0 0 0 1px #d1fae5",
            }}
          >
            {offer.bankName}
          </span>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: "#fffbeb",
              color: "#92400e",
              boxShadow: "inset 0 0 0 1px #fef3c7",
            }}
          >
            {getCategoryLabel(offer.category)}
          </span>
          {expiringSoon && (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: "#fef2f2",
                color: "#b91c1c",
                boxShadow: "inset 0 0 0 1px #fee2e2",
              }}
            >
              Expiring soon
            </span>
          )}
        </div>

        {/* Merchant + title + description */}
        <div className="flex-1">
          {offer.merchant && (
            <p
              className="mb-1 text-xs font-semibold uppercase"
              style={{ color: "#047857", letterSpacing: "0.04em" }}
            >
              {offer.merchant}
            </p>
          )}
          <h2
            className="text-base font-semibold leading-snug transition-colors duration-150"
            style={{ color: "#16201b" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#047857";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#16201b";
            }}
          >
            {offer.title}
          </h2>
          <p
            className="mt-2 line-clamp-3 text-sm leading-6"
            style={{ color: "#6a7d73" }}
          >
            {offer.description}
          </p>
        </div>

        {/* Validity info grid */}
        <dl
          className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs"
          style={{
            background: "#e9f1ec",
            borderRadius: "8px",
            padding: "10px 12px",
          }}
        >
          <div>
            <dt className="font-semibold" style={{ color: "#16201b" }}>Valid until</dt>
            <dd style={{ color: expiringSoon ? "#dc2626" : "#3b4a43" }}>
              {formatDate(offer.validUntil)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold" style={{ color: "#16201b" }}>Last checked</dt>
            <dd style={{ color: "#3b4a43" }}>{formatDate(offer.lastCheckedAt)}</dd>
          </div>
        </dl>

        {/* CTA buttons */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            className="inline-flex flex-1 items-center justify-center text-sm font-semibold text-white transition-colors duration-150"
            href={`/offers/${offer.id}`}
            style={{
              height: "40px",
              borderRadius: "8px",
              background: "#08271c",
              padding: "0 16px",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "#0d3a29";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "#08271c";
            }}
          >
            View details
          </Link>
          <a
            className="inline-flex flex-1 items-center justify-center text-sm font-semibold transition-colors duration-150"
            href={offer.sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              height: "40px",
              borderRadius: "8px",
              border: "1px solid #047857",
              color: "#047857",
              padding: "0 16px",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "#ecfdf5";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            }}
          >
            View at bank
          </a>
        </div>
      </div>
    </article>
  );
}
```

---

## Task 6: EmptyState.tsx — dashed border, muted icon, emerald CTA

**Files:**
- Modify: `components/EmptyState.tsx`

**Key constraint:** Server component. Use Tailwind `hover:` classes for CTA hover state, not JS handlers.

- [ ] **Step 1: Replace the entire file**

```tsx
import Link from "next/link";

// Empty state shown when no offers match the active filters
export function EmptyState() {
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{
        border: "1px dashed #c4d3cb",
        borderRadius: "12px",
        padding: "64px 24px",
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "9999px",
          background: "#e9f1ec",
        }}
      >
        <svg
          width="28"
          height="28"
          fill="none"
          stroke="#95a89e"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold" style={{ color: "#16201b" }}>
        No offers found
      </h2>
      <p
        className="mt-1.5 text-sm"
        style={{ color: "#6a7d73", maxWidth: "360px" }}
      >
        No offers match your current filters. Try adjusting the bank, category, or search term.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex items-center text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800"
        style={{
          height: "40px",
          borderRadius: "8px",
          background: "#047857",
          padding: "0 16px",
        }}
      >
        Clear filters
      </Link>
    </div>
  );
}
```

---

## Task 7: FilterPanel.tsx — emerald/neutral colour tokens

**Files:**
- Modify: `components/FilterPanel.tsx`

**Key constraint:** Already `"use client"` — JS hover on Search button is fine.

- [ ] **Step 1: Replace the entire file**

```tsx
"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { categories } from "@/lib/offers/categories";
import type { Bank, Card, OfferCategory } from "@/lib/offers/types";

interface FilterPanelProps {
  banks: Bank[];
  cards: Card[];
  selectedBankId?: string;
  selectedCardId?: string;
  selectedCategory?: OfferCategory;
  search?: string;
  /** Base path for filter pushes — use the current page path to preserve context */
  actionPath?: string;
}

// Builds a URL string from a base path and a key/value params object, omitting empty values
function buildUrl(base: string, params: Record<string, string>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `${base}?${query}` : base;
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  height: "40px",
  borderRadius: "8px",
  border: "1px solid #c4d3cb",
  background: "#fff",
  padding: "0 12px",
  fontSize: "14px",
  color: "#16201b",
  appearance: "none",
  WebkitAppearance: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#6a7d73",
};

// Filter bar that drives bank/card/category/search query-string navigation
export function FilterPanel({
  banks,
  cards,
  selectedBankId = "",
  selectedCardId = "",
  selectedCategory,
  search = "",
  actionPath = "/",
}: FilterPanelProps) {
  const router = useRouter();

  const availableCards = selectedBankId ? cards.filter((c) => c.bankId === selectedBankId) : cards;
  const bankById = Object.fromEntries(banks.map((b) => [b.id, b]));
  const activeFilterCount = [selectedBankId, selectedCardId, selectedCategory, search].filter(Boolean).length;

  // Pushes a new URL with updated filter values merged over the current state
  function pushFilter(overrides: Partial<{ bank: string; card: string; category: string; search: string }>) {
    const next = {
      bank: selectedBankId,
      card: selectedCardId,
      category: selectedCategory ?? "",
      search,
      ...overrides,
    };
    router.push(buildUrl(actionPath, next) as Route);
  }

  return (
    <div
      style={{
        borderTop: "1px solid #dde7e1",
        borderBottom: "1px solid #dde7e1",
        background: "#fff",
        boxShadow: "0 1px 2px rgb(15 23 42 / 5%)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: "#16201b" }}>
              Filter offers
            </span>
            {activeFilterCount > 0 && (
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white"
                style={{ background: "#047857" }}
              >
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => router.push(actionPath as Route)}
              className="text-sm underline underline-offset-2 transition-colors hover:text-neutral-900"
              style={{ color: "#6a7d73" }}
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_2fr]">
          <div className="grid gap-1">
            <label htmlFor="offer-bank-filter" style={labelStyle}>
              Bank
            </label>
            <select
              id="offer-bank-filter"
              name="bank"
              value={selectedBankId}
              onChange={(e) => pushFilter({ bank: e.target.value, card: "" })}
              style={selectStyle}
            >
              <option value="">All banks</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.shortName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label htmlFor="offer-card-filter" style={labelStyle}>
              Card
            </label>
            <select
              id="offer-card-filter"
              name="card"
              value={selectedCardId}
              onChange={(e) => pushFilter({ card: e.target.value })}
              style={selectStyle}
            >
              <option value="">All cards</option>
              {availableCards.map((card) => {
                const bank = bankById[card.bankId];
                const bankLabel = selectedBankId ? "" : `${bank?.shortName ?? card.bankId} · `;
                return (
                  <option key={card.id} value={card.id}>
                    {bankLabel}{card.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid gap-1">
            <label htmlFor="offer-category-filter" style={labelStyle}>
              Category
            </label>
            <select
              id="offer-category-filter"
              name="category"
              value={selectedCategory ?? ""}
              onChange={(e) => pushFilter({ category: e.target.value })}
              style={selectStyle}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label htmlFor="offer-search-filter" style={labelStyle}>
              Search
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem("search") as HTMLInputElement;
                pushFilter({ search: input.value });
              }}
              className="flex gap-2"
            >
              <input
                id="offer-search-filter"
                name="search"
                defaultValue={search}
                placeholder="Merchant, bank, offer…"
                className="min-w-0 flex-1"
                style={{
                  height: "40px",
                  borderRadius: "8px",
                  border: "1px solid #c4d3cb",
                  padding: "0 12px",
                  fontSize: "14px",
                  color: "#16201b",
                  background: "#fff",
                }}
              />
              <button
                type="submit"
                className="shrink-0 whitespace-nowrap text-sm font-semibold text-white transition-colors duration-150"
                style={{
                  height: "40px",
                  borderRadius: "8px",
                  background: "#047857",
                  padding: "0 16px",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#065f46";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#047857";
                }}
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 8: app/page.tsx — hero section redesign only

**Files:**
- Modify: `app/page.tsx`

**Key constraint:** Server component. Replace only the `<section>` with `bg-gradient-to-br from-slate-950...` block. Everything outside that section (imports, faqJsonLd, FilterPanel, OfferGrid, EmptyState, the commented-out sections) stays exactly as-is. No JS event handlers — use Tailwind for any hover needs.

- [ ] **Step 1: Locate the hero section (lines 87–128 in current file) and replace it**

Replace this block:
```tsx
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-14">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-300">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                Sri Lankan credit card offers
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
                Compare {totalCount.toLocaleString()}+ Sri Lankan Credit Card Offers{" "}
                <span className="text-teal-400">from {bankCount}+ Banks</span>
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Compare active credit card offers across Sri Lankan banks and categories.
                Always verify details at the official bank source before using an offer.
              </p>
            </div>

            <div className="flex gap-3 sm:flex-col sm:gap-2">
              <div className="flex-1 rounded-xl border border-white/10 bg-white/8 px-5 py-4 text-center sm:text-left backdrop-blur-sm">
                <span className="block text-3xl font-bold text-white">{offers.length}</span>
                <span className="mt-0.5 block text-sm text-slate-400">
                  {offers.length === allOffers.length ? "active offers" : "matching offers"}
                </span>
              </div>
              <div className="flex-1 rounded-xl border border-white/10 bg-white/8 px-5 py-4 text-center sm:text-left backdrop-blur-sm">
                <span className="block text-3xl font-bold text-white">{banks.length}</span>
                <span className="mt-0.5 block text-sm text-slate-400">banks tracked</span>
              </div>
            </div>
          </div>
        </div>
      </section>
```

With:
```tsx
      <section style={{ background: "#08271c", color: "#fff" }}>
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-2xl">
              {/* Eyebrow pill */}
              <p
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase"
                style={{
                  background: "rgba(212, 175, 95, 0.16)",
                  border: "1px solid rgba(212, 175, 95, 0.16)",
                  color: "#e1c46e",
                  borderRadius: "9999px",
                  padding: "4px 12px",
                  letterSpacing: "0.04em",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "9999px",
                    background: "#d4af5f",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                Sri Lankan credit card offers
              </p>
              <h1
                className="mt-4 font-bold"
                style={{ fontSize: "44px", lineHeight: 1.1, letterSpacing: "-0.02em" }}
              >
                Compare {totalCount.toLocaleString()}+ Sri Lankan Credit Card Offers{" "}
                <span style={{ color: "#d4af5f" }}>from {bankCount}+ Banks</span>
              </h1>
              <p
                className="mt-4 text-base"
                style={{ lineHeight: 1.7, color: "rgba(255,255,255,0.78)" }}
              >
                Compare active credit card offers across Sri Lankan banks and categories.
                Always verify details at the official bank source before using an offer.
              </p>
            </div>

            <div className="flex gap-3 sm:flex-col sm:gap-2">
              <div
                className="flex-1 text-center sm:text-left"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px",
                  padding: "16px 20px",
                }}
              >
                <span className="block font-bold text-white" style={{ fontSize: "30px" }}>
                  {offers.length}
                </span>
                <span className="mt-0.5 block text-sm" style={{ color: "rgba(255,255,255,0.78)" }}>
                  {offers.length === allOffers.length ? "active offers" : "matching offers"}
                </span>
              </div>
              <div
                className="flex-1 text-center sm:text-left"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px",
                  padding: "16px 20px",
                }}
              >
                <span className="block font-bold text-white" style={{ fontSize: "30px" }}>
                  {banks.length}
                </span>
                <span className="mt-0.5 block text-sm" style={{ color: "rgba(255,255,255,0.78)" }}>
                  banks tracked
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
```

---

## Task 9: app/banks/page.tsx — header section + bank card links

**Files:**
- Modify: `app/banks/page.tsx`

**Key constraint:** Server component. Use Tailwind `hover:` classes for interactive states, not JS handlers.

- [ ] **Step 1: Replace the entire file, preserving all data fetching and JSON-LD**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { getBanks } from "@/lib/offers/banks";
import { getActiveOffers } from "@/lib/offers/repository";
import { siteName, siteUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Sri Lankan Banks with Credit Card Offers",
  description:
    "Browse credit card offers by bank. Compare active promotions from all major Sri Lankan banks including Commercial Bank, Sampath, BOC, NTB, Seylan, and more.",
  openGraph: {
    title: "Sri Lankan Banks with Credit Card Offers",
    description:
      "Browse credit card offers by bank. Compare active promotions from all major Sri Lankan banks.",
    url: `${siteUrl}/banks`,
  },
  alternates: { canonical: `${siteUrl}/banks` },
};

// Banks listing page — shows all tracked banks with their active offer counts
export default async function BanksPage() {
  const banks = getBanks();
  const allOffers = await getActiveOffers();

  const offerCountByBank = new Map<string, number>();
  for (const offer of allOffers) {
    offerCountByBank.set(offer.bankId, (offerCountByBank.get(offer.bankId) ?? 0) + 1);
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Banks", item: `${siteUrl}/banks` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Sri Lankan Banks — ${siteName}`,
    numberOfItems: banks.length,
    itemListElement: banks.map((bank, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: bank.name,
      url: `${siteUrl}/banks/${bank.id}`,
    })),
  };

  return (
    <main>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />

      <section style={{ borderBottom: "1px solid #dde7e1", background: "#fff" }}>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav aria-label="Breadcrumb" className="mb-4 text-xs" style={{ color: "#6a7d73" }}>
            <ol className="flex items-center gap-1.5">
              <li>
                <Link
                  href="/"
                  className="transition-colors hover:text-emerald-700"
                  style={{ color: "#6a7d73" }}
                >
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium" style={{ color: "#16201b" }}>Banks</li>
            </ol>
          </nav>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "#16201b" }}
          >
            Sri Lankan Banks with Credit Card Offers
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "#6a7d73" }}>
            Browse active credit card promotions by bank. Select a bank to see all its current offers.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {banks.map((bank) => {
            const count = offerCountByBank.get(bank.id) ?? 0;
            return (
              <li key={bank.id}>
                <Link
                  href={`/banks/${bank.id}`}
                  className="group flex items-center justify-between transition-all duration-150 hover:border-neutral-300 hover:shadow-md"
                  style={{
                    padding: "16px 20px",
                    borderRadius: "12px",
                    background: "#fff",
                    border: "1px solid #dde7e1",
                    boxShadow: "0 1px 2px rgb(15 23 42 / 5%)",
                    display: "flex",
                  }}
                  aria-label={`${bank.name} — ${count} active offer${count !== 1 ? "s" : ""}`}
                >
                  <div>
                    <p className="font-semibold" style={{ fontSize: "15px", color: "#16201b" }}>
                      {bank.name}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "#6a7d73" }}>
                      {count} active offer{count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span
                    className="ml-4 text-sm font-semibold"
                    style={{ color: "#047857" }}
                    aria-hidden="true"
                  >
                    View →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
```

---

## Task 10: app/offers/[offerId]/page.tsx — detail page redesign

**Files:**
- Modify: `app/offers/[offerId]/page.tsx`

**Key constraint:** Server component. Use Tailwind `hover:` classes for hover states, not JS handlers.

- [ ] **Step 1: Replace the entire file, preserving all data fetching, generateMetadata, JSON-LD, and notFound logic**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { getCategoryLabel } from "@/lib/offers/categories";
import { getOfferById } from "@/lib/offers/repository";
import { siteUrl } from "@/lib/site-config";

interface OfferDetailPageProps {
  params: Promise<{ offerId: string }>;
}

// Formats an ISO date string into a human-readable medium date, or returns "Not specified"
function formatDate(value: string | undefined): string {
  if (!value) {
    return "Not specified";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

// Generates page-level metadata for the offer detail page
export async function generateMetadata({ params }: OfferDetailPageProps): Promise<Metadata> {
  const { offerId } = await params;
  const offer = await getOfferById(offerId);
  if (!offer) return {};

  const validityNote = offer.validUntil ? ` Valid until ${formatDate(offer.validUntil)}.` : "";
  const title = offer.title;
  const description = `${offer.description} — ${offer.bankName} credit card offer.${validityNote}`;

  return {
    title,
    description,
    openGraph: { title, description, url: `${siteUrl}/offers/${offerId}` },
    alternates: { canonical: `${siteUrl}/offers/${offerId}` },
  };
}

// Individual offer detail page showing full metadata and official bank links
export default async function OfferDetailPage({ params }: OfferDetailPageProps) {
  const { offerId } = await params;
  const offer = await getOfferById(offerId);

  if (!offer) {
    notFound();
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: offer.title, item: `${siteUrl}/offers/${offerId}` },
    ],
  };

  const offerJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: offer.title,
    description: offer.description,
    url: `${siteUrl}/offers/${offerId}`,
    category: getCategoryLabel(offer.category),
    offeredBy: {
      "@type": "BankOrCreditUnion",
      name: offer.bankName,
    },
    ...(offer.validFrom && { validFrom: offer.validFrom }),
    ...(offer.validUntil && { validThrough: offer.validUntil }),
    ...(offer.merchant && { seller: { "@type": "Organization", name: offer.merchant } }),
    dateModified: offer.lastCheckedAt,
  };

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={offerJsonLd} />

      <div className="grid gap-4">
        <Link
          className="text-sm font-semibold transition-colors hover:text-emerald-800"
          href="/"
          style={{ color: "#047857" }}
        >
          ← Back to all offers
        </Link>

        {/* Dark hero panel */}
        <div
          style={{
            background: "#08271c",
            borderRadius: "16px",
            padding: "32px 28px",
            color: "#fff",
          }}
        >
          <div className="flex flex-wrap gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
            >
              {offer.bankName}
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: "rgba(212,175,95,0.18)",
                color: "#e1c46e",
              }}
            >
              {getCategoryLabel(offer.category)}
            </span>
          </div>
          <h1
            className="mt-4 font-semibold"
            style={{ fontSize: "30px", color: "#fff", lineHeight: 1.2 }}
          >
            {offer.title}
          </h1>
          <p
            className="mt-4 max-w-3xl text-sm leading-7"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            {offer.description}
          </p>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        {/* Offer details card */}
        <article
          className="p-6"
          style={{
            borderRadius: "16px",
            border: "1px solid #dde7e1",
            background: "#fff",
            boxShadow: "0 1px 2px rgb(15 23 42 / 5%)",
          }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "#16201b" }}>
            Offer details
          </h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2" style={{ color: "#3b4a43" }}>
            <div>
              <dt className="font-semibold" style={{ color: "#16201b" }}>Bank</dt>
              <dd className="mt-1">{offer.bankName}</dd>
            </div>
            {offer.cardName ? (
              <div>
                <dt className="font-semibold" style={{ color: "#16201b" }}>Eligible card</dt>
                <dd className="mt-1">{offer.cardName}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-semibold" style={{ color: "#16201b" }}>Category</dt>
              <dd className="mt-1">{getCategoryLabel(offer.category)}</dd>
            </div>
            {offer.merchant ? (
              <div>
                <dt className="font-semibold" style={{ color: "#16201b" }}>Merchant</dt>
                <dd className="mt-1">{offer.merchant}</dd>
              </div>
            ) : null}
            {offer.location ? (
              <div>
                <dt className="font-semibold" style={{ color: "#16201b" }}>Location</dt>
                <dd className="mt-1">{offer.location}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-semibold" style={{ color: "#16201b" }}>Valid until</dt>
              <dd className="mt-1">{formatDate(offer.validUntil)}</dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: "#16201b" }}>Last checked</dt>
              <dd className="mt-1">{formatDate(offer.lastCheckedAt)}</dd>
            </div>
          </dl>
        </article>

        {/* Sidebar — official links */}
        <aside
          className="grid gap-4 p-6"
          style={{
            background: "#e9f1ec",
            border: "1px solid #dde7e1",
            borderRadius: "16px",
          }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "#16201b" }}>
            Official links
          </h2>
          <p className="text-sm leading-6" style={{ color: "#3b4a43" }}>
            Use the official bank source to confirm the latest eligibility, dates, and exclusions before using the offer.
          </p>
          <a
            className="inline-flex items-center justify-center text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
            href={offer.sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              height: "44px",
              borderRadius: "8px",
              background: "#047857",
              padding: "0 16px",
            }}
          >
            View at bank
          </a>
          <a
            className="inline-flex items-center justify-center text-sm font-semibold transition-colors hover:bg-emerald-50"
            href={offer.terms ?? offer.sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              height: "44px",
              borderRadius: "8px",
              border: "1px solid #047857",
              color: "#047857",
              padding: "0 16px",
              background: "#fff",
            }}
          >
            View terms
          </a>
        </aside>
      </section>
    </main>
  );
}
```

---

## Task 11: Copy brand assets to public/brand

**Files:**
- Shell operation only (no TypeScript changes)

- [ ] **Step 1: Copy assets**

```bash
cp /Users/chaithikaabeywickrame/Desktop/Chaithika/Business/BIZTool/bank-offers/design-spec/assets/sl-card-offers-logo.png \
   /Users/chaithikaabeywickrame/Desktop/Chaithika/Business/BIZTool/bank-offers/public/brand/sl-card-offers-logo.png

cp /Users/chaithikaabeywickrame/Desktop/Chaithika/Business/BIZTool/bank-offers/design-spec/assets/sl-card-offers-logo-reversed.png \
   /Users/chaithikaabeywickrame/Desktop/Chaithika/Business/BIZTool/bank-offers/public/brand/sl-card-offers-logo-reversed.png 2>/dev/null || true

cp /Users/chaithikaabeywickrame/Desktop/Chaithika/Business/BIZTool/bank-offers/design-spec/assets/icon-card.png \
   /Users/chaithikaabeywickrame/Desktop/Chaithika/Business/BIZTool/bank-offers/public/brand/icon-card.png 2>/dev/null || true
```

- [ ] **Step 2: Verify files exist**

```bash
ls /Users/chaithikaabeywickrame/Desktop/Chaithika/Business/BIZTool/bank-offers/public/brand/
```
Expected: `icon-card.png  sl-card-offers-logo-reversed.png  sl-card-offers-logo.png`

---

## Task 12: TypeScript check and fix

**Files:**
- Any file with errors

- [ ] **Step 1: Run TypeScript compiler**

```bash
cd /Users/chaithikaabeywickrame/Desktop/Chaithika/Business/BIZTool/bank-offers && npx tsc --noEmit 2>&1 | head -50
```

Expected: zero errors. If errors appear, fix the specific file/line indicated before moving on.

- [ ] **Step 2: Common issues to watch for**

- `hover:bg-emerald-800` — Tailwind class works only after Task 1 (tailwind.config.ts) is applied; if using Next.js Turbopack the config reload is automatic on save.
- `hover:bg-neutral-100` in Header — same, works after tailwind config extended.
- The `"use client"` directive added to `OfferCard.tsx` in Task 5 must be the very first line (before any import).
- `React.CSSProperties` in `FilterPanel.tsx` — `React` must be importable; since it's `"use client"`, the JSX transform handles it, but the type `React.CSSProperties` requires `import React from "react"` or `import type { CSSProperties } from "react"`. Use `import type { CSSProperties } from "react"` and replace `React.CSSProperties` with `CSSProperties` throughout FilterPanel.

- [ ] **Step 3: Fix FilterPanel import if needed**

If TypeScript reports `Cannot find name 'React'` in FilterPanel.tsx, change:
```tsx
const selectStyle: React.CSSProperties = {
```
and
```tsx
const labelStyle: React.CSSProperties = {
```
To:
```tsx
import type { CSSProperties } from "react";
// ...
const selectStyle: CSSProperties = {
// ...
const labelStyle: CSSProperties = {
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Task 1: Tailwind design tokens (colours, radii, shadows)
- [x] Task 2: CSS custom properties + focus ring
- [x] Task 3: Header border + nav link colours
- [x] Task 4: Footer forest bg + gold gradient rule
- [x] Task 5: OfferCard full redesign (badges, top rule, validity grid, CTAs, hover)
- [x] Task 6: EmptyState dashed border + emerald CTA
- [x] Task 7: FilterPanel emerald/neutral tokens + select styles
- [x] Task 8: Home page hero section
- [x] Task 9: Banks page header + bank card links
- [x] Task 10: Offer detail page back link, dark panel, details card, sidebar
- [x] Task 11: Brand assets copied
- [x] Task 12: TypeScript validation

**Placeholder scan:** None. All code blocks are complete.

**Server component constraint:** Tasks 8, 9, 10 use Tailwind `hover:` classes only. Tasks 5, 7 are `"use client"` and use JS handlers.

**Type consistency:**
- `CSSProperties` from react used in FilterPanel (Task 12 handles this if tsc flags it)
- `OfferCard` prop `{ offer: Offer }` unchanged
- All existing function signatures preserved
