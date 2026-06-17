# Handoff: SL Card Offers — Design System & Website

## Overview
**SL Card Offers** (slcardoffers.com) is a Sri Lankan credit-card offers aggregator. This handoff covers the complete design system and the consumer-facing website: a filterable offer grid, offer detail view, bank directory, saved-offers panel (logged-in), Google Ads slots, and a sign-in modal.

The production codebase (`bank-offers/`, Next.js + Tailwind) is the reference implementation. This design system was built by auditing that codebase and applying a refined **Emerald & Gold** palette.

---

## About the Design Files
The files bundled here (`ui_kits/website/index.html`, component cards, etc.) are **HTML design references** — interactive prototypes showing intended look, layout and behaviour. They are **not** production code to copy directly.

**Your task:** recreate these designs in the **existing Next.js + Tailwind codebase** (`bank-offers/`). The HTML prototypes use inline React styles; the production equivalent should use Tailwind classes and the project's existing component patterns. Use the exact tokens, colors, radii, and spacing documented below.

If you start fresh (no existing codebase), use **Next.js + Tailwind CSS** — that is the original stack.

---

## Fidelity
**High-fidelity.** These are pixel-accurate, color-accurate mockups with:
- Final hex colors (listed below)
- Final typography (Inter variable, exact sizes/weights)
- Final spacing, radius, and shadow values
- Interactive states (hover lifts, focus rings, disabled opacity)
- Full copy and offer data structure

Implement pixel-accurately using the codebase's existing Tailwind + React patterns.

---

## Design Token Reference

### Colors

**Brand anchors**
| Token | Hex | Use |
|---|---|---|
| `--brand-forest` | `#08271c` | Hero bg, dark buttons, footer bg |
| `--brand-emerald` | `#047857` | Primary interactive (accent buttons) |
| `--brand-gold` | `#c99a2e` | Offer card top-rule, footer rule |
| `--brand-ink` | `#16201b` | Text logo fallback |

**Emerald scale** (primary brand)
| Token | Hex |
|---|---|
| `--emerald-50` | `#ecfdf5` |
| `--emerald-100` | `#d1fae5` |
| `--emerald-200` | `#a7f3d0` |
| `--emerald-300` | `#6ee7b7` |
| `--emerald-400` | `#34d399` |
| `--emerald-500` | `#10b981` |
| `--emerald-600` | `#059669` |
| `--emerald-700` | `#047857` ← action color (white text 5.5:1 AA) |
| `--emerald-800` | `#065f46` |
| `--emerald-900` | `#064e3b` |
| `--emerald-950` | `#03281d` |

**Gold scale** (rewards/premium accent — fills & large elements only, NOT small text on white)
| Token | Hex |
|---|---|
| `--gold-50`  | `#fbf7ea` |
| `--gold-100` | `#f6ecc9` |
| `--gold-200` | `#edd99b` |
| `--gold-300` | `#e1c46e` |
| `--gold-400` | `#d4af5f` |
| `--gold-500` | `#c99a2e` |
| `--gold-600` | `#a87d1f` |
| `--gold-700` | `#856115` |
| `--gold-800` | `#5f4510` |

**Neutral scale** (green-tinted gray)
| Token | Hex | Contrast on white |
|---|---|---|
| `--neutral-50`  | `#f4f9f6` | — |
| `--neutral-100` | `#e9f1ec` | — |
| `--neutral-200` | `#dde7e1` | — (borders) |
| `--neutral-300` | `#c4d3cb` | — (borders) |
| `--neutral-400` | `#95a89e` | ~3:1 (decorative only) |
| `--neutral-500` | `#6a7d73` | ~4.6:1 AA |
| `--neutral-600` | `#51635a` | ~6.6:1 AA |
| `--neutral-700` | `#3b4a43` | ~9:1 AA |
| `--neutral-800` | `#25322c` | — |
| `--neutral-900` | `#16201b` | ~15:1 AA |
| `--neutral-950` | `#0c1410` | — |

**Semantic accents**
| Purpose | Background | Text | Ring |
|---|---|---|---|
| Bank badge | `#e3f1ea` | `#065f46` (emerald-800) | `#d1fae5` |
| Category badge | `#fffbeb` (amber-50) | `#92400e` (amber-800) | `#fef3c7` |
| Expiry badge | `#fef2f2` (red-50) | `#b91c1c` (red-700) | `#fee2e2` |
| Featured/premium badge | `#fbf7ea` (gold-50) | `#5f4510` (gold-800) | `#edd99b` |
| Neutral badge | `#e9f1ec` | `#3b4a43` | `#dde7e1` |
| Success badge | `#f0fdf4` | `#15803d` | `#dcfce7` |

**Semantic surfaces & text**
| Token | Value |
|---|---|
| `--bg-page` | `#f4f9f6` |
| `--surface-card` | `#ffffff` |
| `--surface-muted` | `#e9f1ec` |
| `--surface-inverse` | `#08271c` |
| `--text-strong` | `#16201b` |
| `--text-body` | `#3b4a43` |
| `--text-muted` | `#6a7d73` |
| `--text-faint` | `#95a89e` |
| `--text-link` | `#047857` |
| `--border-subtle` | `#dde7e1` |
| `--border-default` | `#c4d3cb` |
| `--border-focus` | `#10b981` |
| `--ring-focus` | `#10b981` at 32% opacity |

---

### Typography
**Font:** Inter variable — `font-family: 'Inter', system-ui, sans-serif;`
Google Fonts URL: `https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap`

| Role | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|
| Display / Hero h1 | 44–48px | 700 | 1.1 | −0.02em |
| Page H1 | 30px | 700 | 1.15 | −0.02em |
| Section H2 | 20px | 600 | 1.35 | 0 |
| Card H3 / sub-head | 18px | 600 | 1.35 | 0 |
| Offer title | 16px | 600 | 1.35 | 0 |
| Body (workhorse) | 14px | 400 | 1.55 | 0 |
| Meta / caption | 12px | 400 | 1.5 | 0 |
| Eyebrow / field label | 12px | 600 | 1.4 | +0.04em, UPPERCASE |

---

### Spacing (4px base grid)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64px`

### Border radius
| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | Inputs, chips |
| `--radius-md` | 8px | Buttons, selects |
| `--radius-lg` | 12px | Cards |
| `--radius-xl` | 16px | Feature panels, modals |
| `--radius-pill` | 9999px | Badges, avatars |

### Shadows
| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgb(15 23 42 / 5%)` | Resting card |
| `--shadow-md` | `0 4px 12px -2px rgb(15 23 42 / 10%), 0 2px 6px -2px rgb(15 23 42 / 6%)` | Card hover lift |
| `--shadow-lg` | `0 12px 28px -6px rgb(15 23 42 / 16%)` | Modals / overlays |

---

## Component Library

### Button
Four variants, three sizes.

| Variant | Background | Text | Border | Hover bg |
|---|---|---|---|---|
| `primary` | `#08271c` (forest) | `#fff` | transparent | `#0d3a29` |
| `accent` | `#047857` (emerald-700) | `#fff` | transparent | `#065f46` |
| `outline` | `#fff` | `#047857` | `1px solid #047857` | `#ecfdf5` |
| `ghost` | transparent | `#3b4a43` | transparent | `#e9f1ec` |

| Size | Height | Padding | Font size |
|---|---|---|---|
| `sm` | 32px | 0 12px | 13px |
| `md` | 40px | 0 16px | 14px |
| `lg` | 44px | 0 20px | 14px |

Border-radius: 8px. Font-weight: 600. Transition: `background-color 150ms ease`.
Disabled: `opacity: 0.5`, `cursor: not-allowed`.

### Badge (pill)
Height: auto. Padding: `4px 12px`. Border-radius: 9999px. Font: 12px/600. `box-shadow: inset 0 0 0 1px <ring>`.
Tones: bank (emerald), category (amber), expiry (red), premium (gold), neutral (gray), success (green). See color table above.

### Input
Height: 40px. Padding: `0 12px` (or `0 12px 0 38px` with leading icon). Font: 14px/400.
Border: `1px solid #c4d3cb`. Border-radius: 8px. Focus: `border-color: #10b981` + `box-shadow: 0 0 0 3px rgba(16,185,129,.32)`.

### Select
Same as Input. Native `<select>` with `appearance: none` + custom chevron SVG (16px, `stroke="#6a7d73"`, strokeWidth 2) positioned at right 12px.

### SearchBar
Row: `Input (flex:1) + Button variant="accent"` with gap 8px. Input has leading magnifier icon (16px, `stroke="#95a89e"`).

### OfferCard
White surface, `border-radius: 12px`, `border: 1px solid #dde7e1`, `box-shadow: shadow-sm`. Hover: border → `#c4d3cb`, shadow → `shadow-md`.
- **Top rule**: 4px, `background: linear-gradient(90deg, #059669, #c99a2e)`.
- **Header**: flex row of Badge (bank, category) + optional expiry badge.
- **Merchant eyebrow**: 12px/600/uppercase/`#047857` (`--text-link`).
- **Title**: 16px/600, `#16201b`. Hover: `#047857`.
- **Description**: 14px/400 `#6a7d73`, `-webkit-line-clamp: 3`.
- **Validity grid**: `background: #e9f1ec`, `border-radius: 8px`, `padding: 10px 12px`. 2-column grid. Font 12px. Keys 600 `#16201b`, values `#3b4a43` (expiring: `#dc2626`).
- **CTA row**: `Button primary ("View details") + Button outline ("View at bank")`, flex, gap 8px.

### BankCard
Horizontal tile: `padding: 16px 20px`, `border-radius: 12px`, white bg. Name: 15px/600 `#16201b`. Offer count: 12px `#6a7d73`. "View →": 14px/600 `#047857`. Hover lift same as OfferCard.

### StatTile
On dark hero. `background: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.12)`, `border-radius: 12px`, `padding: 16px 20px`. Value: 30px/700 white. Label: 14px `rgba(255,255,255,0.78)`.

### Header
Sticky, `height: 64px`. `background: rgba(255,255,255,0.9)`, `backdrop-filter: blur(8px)`. `border-bottom: 1px solid #dde7e1`. Logo left; nav + auth slot right.
Nav items: 14px/500, padding `8px 12px`, radius 6px. Active: bg `#e9f1ec`, text `#16201b`. Idle: text `#3b4a43`, transparent bg.
Auth: "Sign in" → `Button accent size="sm"`. Signed in: avatar circle 32px, bg `#d1fae5`, text `#065f46`, 13px/700, initial of user name.

### Hero
Full-width section. `background: #08271c` (solid forest, no gradient). Color: white. Padding: `48px 16px`.
- **Eyebrow pill**: `background: rgba(212,175,95,0.16)`, `border: 1px solid rgba(212,175,95,0.16)`, text `#e1c46e` (gold-300), 12px/600/uppercase, leading dot `#d4af5f` (gold-400).
- **H1**: 44px/700, line-height 1.1. Highlight tail (e.g. "from 12+ banks"): `color: #d4af5f`.
- **Subtitle**: 16px/400, line-height 1.7, `rgba(255,255,255,0.78)`.
- **Stat tiles**: flex column, gap 8px, minWidth 180px — see StatTile above.

### Footer
`background: #08271c`. Top accent: `height: 2px; background: linear-gradient(90deg, #a87d1f, #e1c46e 50%, #a87d1f)` (metallic gold).
Content row: max-width 1280px, padding `32px 16px`, flex wrap, justify space-between.
- Brand name: 14px/600 `#e1c46e` (gold-300).
- Disclaimer: 12px `rgba(255,255,255,0.55)`.
- Copyright: 12px `rgba(255,255,255,0.55)`.

### EmptyState
Dashed card: `border: 1px dashed #c4d3cb`, `border-radius: 12px`, padding `64px 24px`, centered.
Icon container: 56×56 circle, bg `#e9f1ec`. SVG icon: 28px, `stroke="#95a89e"`.
Title: 18px/600 `#16201b`. Description: 14px/400 `#6a7d73`, max-width 360px.
Action: `Button variant="accent"`.

---

## Screens / Views

### 1 — Homepage (offer grid)
**Layout:** Full-page flex column. Header (sticky 64px) → Hero band → FilterBar → AdSlot → OfferGrid → Footer.

**Hero:** as described above. Stats show live offer/bank count.

**FilterBar:**
- `background: #fff`, `border-top: 1px solid #dde7e1`, `border-bottom: 1px solid #dde7e1`, `box-shadow: shadow-sm`.
- Inner: max-width 1280px, padding `12px 16px`.
- Top row: "Filter offers" label (14px/600) + active-filter count Badge + "Clear all" text button (14px, underlined, `#6a7d73`).
- Fields grid: `grid-template-columns: 1fr 1fr 2fr`, gap 12px.
  - Select "Bank", Select "Category", SearchBar.

**AdSlot (planned):**
- `height: 90px`, `border: 1px dashed #c4d3cb`, `border-radius: 12px`, bg `#fff`, centered label "Advertisement · 728 × 90 leaderboard", 12px/uppercase `#95a89e`.
- Max-width 1280px, margins `20px 16px 0`.

**OfferGrid:**
- Max-width 1280px, padding `24px 16px 40px`.
- `display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-items: stretch`.
- Each cell is an `OfferCard` with an absolute-positioned `IconButton` (heart) at top-right (40×40, bg `#fff`).
- Heart filled + red when saved; grey when unsaved.
- Clicking heart when signed out → opens SignInModal.

**Responsive:**
- ≥1024px: 3 columns
- 640–1023px: 2 columns
- <640px: 1 column

---

### 2 — Offer Detail
**Layout:** single column, max-width 1040px, margin auto, padding `32px 16px`.

**Back link:** `← Back to all offers`, 14px/600 `#047857`. No border, cursor pointer.

**Dark header panel:** `background: #08271c`, `border-radius: 16px`, `padding: 32px 28px`.
- Badges row: bank (semi-transparent white), category (gold tint), expiry (red tint) — pill style on dark.
- H1: 30px/600 white.
- Description: 14px line-height 1.7, `rgba(255,255,255,0.78)`.

**Two-column section** below: `grid-template-columns: 2fr 1fr`, gap 24px.
- **Details card** (left): white card, `border-radius: 16px`, `padding: 24px`. H2 "Offer details" 18px/600. `<dl>` grid 2-col, 14px, keys 600 `#16201b`, values `#3b4a43`. Fields: Bank, Eligible card, Category, Merchant, Location, Valid until, Last checked.
- **Official links sidebar** (right): `background: #e9f1ec`, `border: 1px solid #dde7e1`, `border-radius: 16px`, `padding: 24px`. H2 18px/600. Helper text 14px `#6a7d73`. `Button accent size="lg" fullWidth` "View at bank". `Button outline size="lg" fullWidth` "View terms".

---

### 3 — Browse Banks
**Page header:** `background: #fff`, `border-bottom: 1px solid #dde7e1`. Max-width 1280px, padding `32px 16px`. Breadcrumb (12px), H1 (30px/700), subtitle (14px `#6a7d73`).

**Banks grid:** max-width 1280px, padding `32px 16px`. `grid-template-columns: repeat(3, 1fr)`, gap 16px. Each cell: `BankCard`. Clicking → filters homepage by that bank.

---

### 4 — Saved Offers (logged-in)
Replaces hero with a plain page header: white bg, H1 "Saved offers" 28px/700 `#16201b`, subtitle "N offers saved to your account" 14px `#6a7d73`.
Same FilterBar + grid below, filtered to saved offers only.
Empty state shows "No saved offers yet" variant.
**Floating FAB** (signed-in, not on detail): `position: fixed; right: 20px; bottom: 20px`. `Button primary iconLeft=<Heart>` "Saved (N)".

---

### 5 — Sign-In Modal
**Scrim:** `position: fixed; inset: 0; background: rgba(2,6,23,.55); backdrop-filter: blur(2px)`. Click outside to close.
**Dialog:** `width: 380px; background: #fff; border-radius: 16px; box-shadow: shadow-lg; padding: 28px`.
- Brand icon: `assets/icon-card.png` 44px.
- H2: 20px/700 `#16201b` "Sign in to save offers".
- Body: 14px/400 `#6a7d73` line-height 1.6.
- Buttons: `Button primary size="lg" fullWidth` "Continue with Google", `Button outline size="lg" fullWidth` "Continue with email". Gap 12px.
- Legal copy: 12px centered `#95a89e`.

---

## Interactions & Behaviour

| Trigger | Action |
|---|---|
| OfferCard hover | border `#dde7e1→#c4d3cb`, shadow sm→md, title color `#16201b→#047857` |
| BankCard hover | same shadow/border lift |
| Button hover | bg darkens by one scale step (see variants above), 150ms ease |
| Focus any control | `border-color: #10b981` + `box-shadow: 0 0 0 3px rgba(16,185,129,.32)` |
| Heart click (signed out) | open SignInModal |
| Heart click (signed in) | toggle saved state (persist to user account) |
| "View details" | navigate to Offer Detail page |
| "View at bank" | `window.open(sourceUrl, '_blank')` |
| Bank card click | filter homepage to that bank |
| "Clear all" | reset all 3 filters to empty |
| Sign in | dismiss modal, set signed-in state |
| Back link | pop browser history |
| Header nav | client-side navigation, update active state |
| Ad slot | render Google AdSense `<ins>` tag (leaderboard 728×90 or responsive) |

**Transitions:** `150ms ease` for color, background, box-shadow. No scaling, no translation.

---

## State Management
| Variable | Type | Notes |
|---|---|---|
| `filters.bank` | string (bank id or "") | Applied to API query |
| `filters.category` | string (category id or "") | Applied to API query |
| `filters.search` | string | Full-text search |
| `signedIn` | boolean | Auth state |
| `saved` | Record<offerId, boolean> | Persisted to user account |
| `currentOffer` | Offer \| null | Detail view |
| `showSignIn` | boolean | Modal open state |

---

## Data Model
```ts
type Offer = {
  id: string;
  bankId: string;
  bankName: string;
  category: 'dining'|'fuel'|'supermarket'|'travel'|'online'|'installment'|'cashback'|'bogo'|'other';
  merchant?: string;
  title: string;
  description: string;
  validUntil: string;       // formatted date string
  lastChecked: string;      // formatted date string
  expiringSoon: boolean;    // true if <14 days to validUntil
  sourceUrl: string;        // official bank URL
  cardName: string;         // eligible card name
  location: string;
};

type Bank = { id: string; name: string; shortName: string; };
```

---

## Assets

| File | Use |
|---|---|
| `assets/sl-card-offers-logo.png` | Header wordmark (light bg) |
| `assets/sl-card-offers-logo-reversed.png` | Header wordmark (dark bg) |
| `assets/icon-card.png` | App/PWA icon, sign-in modal, avatar fallback |
| `assets/favicon.png` | Browser favicon |

All assets: Emerald & Gold palette (disc `#059669`, gold chip `#c99a2e`, forest text `#08271c`). Pre-recolour originals in `uploads/`.

---

## Files in this Bundle

| File | Description |
|---|---|
| `README.md` | This file |
| `ui_kits/website/index.html` | Full interactive website prototype |
| `ui_kits/website/app.js` | Prototype screens & interactions |
| `ui_kits/website/data.js` | Sample offer/bank data |
| `tokens/colors.css` | All color tokens with AA contrast notes |
| `tokens/typography.css` | Type scale tokens |
| `tokens/spacing.css` | Spacing, radius, shadow, layout tokens |
| `styles.css` | Root CSS entry (imports tokens) |
| `components/core/Button.jsx` | Button component |
| `components/core/Badge.jsx` | Badge component |
| `components/core/IconButton.jsx` | Icon button |
| `components/forms/Input.jsx` | Text input |
| `components/forms/Select.jsx` | Select / dropdown |
| `components/forms/SearchBar.jsx` | Search field + button |
| `components/data/OfferCard.jsx` | Signature offer card |
| `components/data/BankCard.jsx` | Bank directory tile |
| `components/data/StatTile.jsx` | Hero stat tile |
| `components/layout/Header.jsx` | Sticky header |
| `components/layout/Hero.jsx` | Dark hero band |
| `components/layout/Footer.jsx` | Dark footer |
| `components/feedback/EmptyState.jsx` | No-results state |
| `assets/*.png` | Logo, icon, favicon |

---

## Source Repository
The original production codebase: **https://github.com/CSAbeywickrame/sl-bank-offers**
Browse this to understand the existing Next.js routing (`app/`), Tailwind config, offer data model, and component patterns before building.

---

## Notes for Claude Code
1. The production stack is **Next.js (App Router) + Tailwind**. Map the token values to Tailwind config (`theme.extend.colors`, `theme.extend.borderRadius`, etc.) so all components can use class utilities.
2. The `bank-offers/data/seed.json` file has real scraped offer data — use that to populate the initial DB or static props.
3. The sign-in flow (Google / email) and saved-offers persistence are planned features — stub with auth provider of choice (e.g. NextAuth.js).
4. Google AdSense slots: add `<ins class="adsbygoogle">` with the standard leaderboard size. Label the slot with a wrapping div `role="complementary" aria-label="Advertisement"` to separate ads from offers clearly.
5. Accessibility: every interactive element needs `:focus-visible` using the `--ring-focus` value; all form controls need labels; color alone never conveys meaning (the expiry date also uses red text AND the "Expiring soon" badge).
