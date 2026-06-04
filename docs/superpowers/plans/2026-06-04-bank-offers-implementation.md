# Bank Offers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Sri Lankan bank credit card offers directory with automated ingestion, category/bank filtering, official source links, and a daily refresh path.

**Architecture:** Use a Next.js App Router application with a small file-backed data layer for the MVP. Keep offer domain logic in `lib/offers`, ingestion logic in `lib/ingest`, source configuration in `lib/sources`, and UI components in `components` so scraping, filtering, and presentation can evolve independently.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Cheerio for HTML parsing, Vitest for unit tests, Playwright for browser verification, JSON file storage for MVP data.

---

## File Structure

Create this structure in the repository root:

```text
app/
  banks/[bankId]/page.tsx
  categories/[category]/page.tsx
  globals.css
  layout.tsx
  page.tsx
components/
  BankCategoryNav.tsx
  EmptyState.tsx
  FilterPanel.tsx
  OfferCard.tsx
  OfferGrid.tsx
data/
  offers.json
docs/
  superpowers/
    plans/
      2026-06-04-bank-offers-implementation.md
    specs/
      2026-06-04-bank-offers-design.md
lib/
  ingest/
    categorize.ts
    extractHtmlOffers.ts
    ingest.ts
    persist.ts
  offers/
    banks.ts
    categories.ts
    filter.ts
    repository.ts
    types.ts
  sources/
    bankSources.ts
scripts/
  refresh-offers.ts
tests/
  ingest/
    categorize.test.ts
    ingest.test.ts
  offers/
    filter.test.ts
  ui/
    home.spec.ts
```

Responsibilities:

- `lib/offers/types.ts`: canonical offer, bank, category, and filter types.
- `lib/offers/banks.ts`: supported bank metadata and slug lookup helpers.
- `lib/offers/categories.ts`: category metadata and display order.
- `lib/offers/filter.ts`: pure filtering/search functions shared by pages and tests.
- `lib/offers/repository.ts`: read-only offer access for the website.
- `lib/ingest/categorize.ts`: deterministic keyword categorization.
- `lib/ingest/extractHtmlOffers.ts`: HTML extraction utilities using Cheerio.
- `lib/ingest/ingest.ts`: refresh orchestration for all enabled sources.
- `lib/ingest/persist.ts`: JSON persistence, dedupe, inactive, and expired handling.
- `lib/sources/bankSources.ts`: bank source registry.
- `components/*`: focused React UI building blocks.
- `scripts/refresh-offers.ts`: command-line entry point for manual and scheduled refreshes.
- `tests/*`: unit and browser coverage for the MVP.

---

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`

- [ ] **Step 1: Create package manifest**

Create `package.json`:

```json
{
  "name": "sl-bank-offers",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "refresh": "tsx scripts/refresh-offers.ts"
  },
  "dependencies": {
    "@tailwindcss/postcss": "^4.1.8",
    "cheerio": "^1.0.0",
    "clsx": "^2.1.1",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0",
    "@types/node": "^22.15.29",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.1.8",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vitest": "^3.1.4"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm reports installed packages with no fatal errors.

- [ ] **Step 3: Create TypeScript and framework config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
```

Create `postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};

export default config;
```

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {}
  }
};

export default config;
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname
    }
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/ui",
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120000
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ]
});
```

Create `.gitignore`:

```gitignore
.DS_Store
node_modules/
.next/
coverage/
playwright-report/
test-results/
.env
.env.local
```

- [ ] **Step 4: Create app shell**

Create `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sri Lankan Bank Card Offers",
  description: "Browse Sri Lankan credit card offers by bank and category."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `app/globals.css`:

```css
@import "tailwindcss";

:root {
  color-scheme: light;
  --background: #f6f7f9;
  --foreground: #18202a;
  --muted: #667085;
  --surface: #ffffff;
  --border: #d9e0e8;
  --accent: #0f766e;
  --accent-strong: #115e59;
  --warning: #b45309;
}

* {
  box-sizing: border-box;
}

html {
  background: var(--background);
}

body {
  margin: 0;
  color: var(--foreground);
  background: var(--background);
  font-family: Arial, Helvetica, sans-serif;
}

a {
  color: inherit;
}

button,
input,
select {
  font: inherit;
}
```

Create temporary `app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-normal">Sri Lankan Bank Card Offers</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-600">
        Browse credit card offers from Sri Lankan banks in one place.
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Verify scaffold**

Run:

```bash
npm run build
```

Expected: Next.js production build completes successfully.

- [ ] **Step 6: Commit**

Run:

```bash
git add .gitignore package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs tailwind.config.ts vitest.config.ts playwright.config.ts app/layout.tsx app/globals.css app/page.tsx
git commit -m "chore: scaffold bank offers app"
```

Expected: commit succeeds and `.DS_Store` files remain untracked or ignored.

---

### Task 2: Define Offer Domain And Seed Data

**Files:**
- Create: `lib/offers/types.ts`
- Create: `lib/offers/categories.ts`
- Create: `lib/offers/banks.ts`
- Create: `data/offers.json`
- Create: `lib/offers/repository.ts`

- [ ] **Step 1: Create domain types**

Create `lib/offers/types.ts`:

```ts
export type OfferCategory =
  | "dining"
  | "travel"
  | "hotels"
  | "shopping"
  | "supermarkets"
  | "fuel"
  | "health"
  | "education"
  | "online"
  | "entertainment"
  | "other";

export type OfferStatus = "auto_published" | "inactive" | "expired" | "needs_review";

export type SourceType = "static_html" | "dynamic_page" | "feed" | "pdf_or_image" | "unknown";

export interface Bank {
  id: string;
  name: string;
  shortName: string;
  websiteUrl: string;
}

export interface Offer {
  id: string;
  bankId: string;
  bankName: string;
  title: string;
  category: OfferCategory;
  description: string;
  merchant?: string;
  location?: string;
  cardType?: string;
  validFrom?: string;
  validUntil?: string;
  terms?: string;
  sourceUrl: string;
  imageUrl?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastCheckedAt: string;
  status: OfferStatus;
  rawSourceHash: string;
}

export interface OfferFilters {
  bankId?: string;
  category?: OfferCategory;
  search?: string;
}
```

- [ ] **Step 2: Create category metadata**

Create `lib/offers/categories.ts`:

```ts
import type { OfferCategory } from "./types";

export interface CategoryMeta {
  id: OfferCategory;
  label: string;
}

export const categories: CategoryMeta[] = [
  { id: "dining", label: "Dining" },
  { id: "travel", label: "Travel" },
  { id: "hotels", label: "Hotels" },
  { id: "shopping", label: "Shopping" },
  { id: "supermarkets", label: "Supermarkets" },
  { id: "fuel", label: "Fuel" },
  { id: "health", label: "Health" },
  { id: "education", label: "Education" },
  { id: "online", label: "Online" },
  { id: "entertainment", label: "Entertainment" },
  { id: "other", label: "Other" }
];

export function getCategoryLabel(category: OfferCategory): string {
  return categories.find((item) => item.id === category)?.label ?? "Other";
}

export function isOfferCategory(value: string): value is OfferCategory {
  return categories.some((category) => category.id === value);
}
```

- [ ] **Step 3: Create bank metadata**

Create `lib/offers/banks.ts`:

```ts
import type { Bank } from "./types";

export const banks: Bank[] = [
  { id: "hnb", name: "Hatton National Bank", shortName: "HNB", websiteUrl: "https://www.hnb.net" },
  { id: "commercial-bank", name: "Commercial Bank of Ceylon", shortName: "Commercial Bank", websiteUrl: "https://www.combank.lk" },
  { id: "cdb", name: "Citizens Development Business Finance", shortName: "CDB", websiteUrl: "https://www.cdb.lk" },
  { id: "ndb", name: "National Development Bank", shortName: "NDB", websiteUrl: "https://www.ndbbank.com" },
  { id: "peoples-bank", name: "People's Bank", shortName: "People's Bank", websiteUrl: "https://www.peoplesbank.lk" },
  { id: "nsb", name: "National Savings Bank", shortName: "NSB", websiteUrl: "https://www.nsb.lk" },
  { id: "boc", name: "Bank of Ceylon", shortName: "BOC", websiteUrl: "https://www.boc.lk" },
  { id: "ntb", name: "Nations Trust Bank", shortName: "NTB", websiteUrl: "https://www.nationstrust.com" },
  { id: "sampath", name: "Sampath Bank", shortName: "Sampath", websiteUrl: "https://www.sampath.lk" },
  { id: "dfcc", name: "DFCC Bank", shortName: "DFCC", websiteUrl: "https://www.dfcc.lk" }
];

export function getBankById(bankId: string): Bank | undefined {
  return banks.find((bank) => bank.id === bankId);
}
```

- [ ] **Step 4: Create seed offers**

Create `data/offers.json`:

```json
[
  {
    "id": "hnb-dining-seed",
    "bankId": "hnb",
    "bankName": "Hatton National Bank",
    "title": "Dining offer sample",
    "category": "dining",
    "description": "Sample dining offer used while the automated refresh is being configured.",
    "merchant": "Selected restaurants",
    "location": "Sri Lanka",
    "cardType": "Credit cards",
    "validUntil": "2026-12-31",
    "sourceUrl": "https://www.hnb.net",
    "firstSeenAt": "2026-06-04T00:00:00.000Z",
    "lastSeenAt": "2026-06-04T00:00:00.000Z",
    "lastCheckedAt": "2026-06-04T00:00:00.000Z",
    "status": "auto_published",
    "rawSourceHash": "seed-hnb-dining"
  },
  {
    "id": "dfcc-hotels-seed",
    "bankId": "dfcc",
    "bankName": "DFCC Bank",
    "title": "Hotel offer sample",
    "category": "hotels",
    "description": "Sample hotel offer used to verify category filtering.",
    "merchant": "Selected hotels",
    "location": "Sri Lanka",
    "cardType": "Credit cards",
    "sourceUrl": "https://www.dfcc.lk",
    "firstSeenAt": "2026-06-04T00:00:00.000Z",
    "lastSeenAt": "2026-06-04T00:00:00.000Z",
    "lastCheckedAt": "2026-06-04T00:00:00.000Z",
    "status": "auto_published",
    "rawSourceHash": "seed-dfcc-hotels"
  }
]
```

- [ ] **Step 5: Create repository reader**

Create `lib/offers/repository.ts`:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Offer } from "./types";

const dataPath = path.join(process.cwd(), "data", "offers.json");

export async function getAllOffers(): Promise<Offer[]> {
  const raw = await readFile(dataPath, "utf8");
  return JSON.parse(raw) as Offer[];
}

export async function getActiveOffers(): Promise<Offer[]> {
  const offers = await getAllOffers();
  return offers.filter((offer) => offer.status === "auto_published");
}
```

- [ ] **Step 6: Verify build**

Run:

```bash
npm run build
```

Expected: build completes successfully.

- [ ] **Step 7: Commit**

Run:

```bash
git add lib/offers/types.ts lib/offers/categories.ts lib/offers/banks.ts lib/offers/repository.ts data/offers.json
git commit -m "feat: add offer domain model"
```

Expected: commit succeeds.

---

### Task 3: Implement Filtering Logic

**Files:**
- Create: `lib/offers/filter.ts`
- Create: `tests/offers/filter.test.ts`

- [ ] **Step 1: Write failing filter tests**

Create `tests/offers/filter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterOffers } from "@/lib/offers/filter";
import type { Offer } from "@/lib/offers/types";

const offers: Offer[] = [
  {
    id: "1",
    bankId: "hnb",
    bankName: "Hatton National Bank",
    title: "Buffet discount",
    category: "dining",
    description: "Dining at selected restaurants",
    merchant: "Colombo Restaurant",
    sourceUrl: "https://example.com/hnb",
    firstSeenAt: "2026-06-04T00:00:00.000Z",
    lastSeenAt: "2026-06-04T00:00:00.000Z",
    lastCheckedAt: "2026-06-04T00:00:00.000Z",
    status: "auto_published",
    rawSourceHash: "a"
  },
  {
    id: "2",
    bankId: "dfcc",
    bankName: "DFCC Bank",
    title: "Hotel stay offer",
    category: "hotels",
    description: "Rooms at selected hotels",
    merchant: "Coastal Hotel",
    sourceUrl: "https://example.com/dfcc",
    firstSeenAt: "2026-06-04T00:00:00.000Z",
    lastSeenAt: "2026-06-04T00:00:00.000Z",
    lastCheckedAt: "2026-06-04T00:00:00.000Z",
    status: "auto_published",
    rawSourceHash: "b"
  }
];

describe("filterOffers", () => {
  it("filters by bank and category together", () => {
    const result = filterOffers(offers, { bankId: "hnb", category: "dining" });
    expect(result.map((offer) => offer.id)).toEqual(["1"]);
  });

  it("searches title, bank, merchant, description, and category", () => {
    expect(filterOffers(offers, { search: "coastal" }).map((offer) => offer.id)).toEqual(["2"]);
    expect(filterOffers(offers, { search: "hatton" }).map((offer) => offer.id)).toEqual(["1"]);
    expect(filterOffers(offers, { search: "hotel" }).map((offer) => offer.id)).toEqual(["2"]);
  });

  it("ignores empty filter values", () => {
    expect(filterOffers(offers, { bankId: "", search: " " })).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- tests/offers/filter.test.ts
```

Expected: FAIL because `lib/offers/filter.ts` does not exist.

- [ ] **Step 3: Implement filter logic**

Create `lib/offers/filter.ts`:

```ts
import { getCategoryLabel } from "./categories";
import type { Offer, OfferFilters } from "./types";

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function searchableText(offer: Offer): string {
  return [
    offer.title,
    offer.bankName,
    offer.category,
    getCategoryLabel(offer.category),
    offer.description,
    offer.merchant,
    offer.location,
    offer.cardType,
    offer.terms
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterOffers(offers: Offer[], filters: OfferFilters): Offer[] {
  const bankId = normalize(filters.bankId);
  const search = normalize(filters.search);

  return offers.filter((offer) => {
    if (bankId && offer.bankId !== bankId) {
      return false;
    }

    if (filters.category && offer.category !== filters.category) {
      return false;
    }

    if (search && !searchableText(offer).includes(search)) {
      return false;
    }

    return true;
  });
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
npm run test -- tests/offers/filter.test.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/offers/filter.ts tests/offers/filter.test.ts
git commit -m "feat: add offer filtering"
```

Expected: commit succeeds.

---

### Task 4: Build Ingestion Categorization And Persistence

**Files:**
- Create: `lib/ingest/categorize.ts`
- Create: `lib/ingest/persist.ts`
- Create: `tests/ingest/categorize.test.ts`
- Create: `tests/ingest/ingest.test.ts`

- [ ] **Step 1: Write categorization tests**

Create `tests/ingest/categorize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { categorizeOfferText } from "@/lib/ingest/categorize";

describe("categorizeOfferText", () => {
  it("maps obvious dining terms to dining", () => {
    expect(categorizeOfferText("20% off buffet at selected restaurants")).toBe("dining");
  });

  it("maps hotel and stay terms to hotels", () => {
    expect(categorizeOfferText("Special room rate at beach resort")).toBe("hotels");
  });

  it("uses other when the text is unclear", () => {
    expect(categorizeOfferText("Special seasonal benefit")).toBe("other");
  });
});
```

- [ ] **Step 2: Write persistence tests**

Create `tests/ingest/ingest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mergeOffers } from "@/lib/ingest/persist";
import type { Offer } from "@/lib/offers/types";

const now = "2026-06-04T12:00:00.000Z";

function offer(id: string, overrides: Partial<Offer> = {}): Offer {
  return {
    id,
    bankId: "hnb",
    bankName: "Hatton National Bank",
    title: "Dining offer",
    category: "dining",
    description: "Offer description",
    sourceUrl: "https://example.com",
    firstSeenAt: "2026-06-01T00:00:00.000Z",
    lastSeenAt: "2026-06-01T00:00:00.000Z",
    lastCheckedAt: "2026-06-01T00:00:00.000Z",
    status: "auto_published",
    rawSourceHash: "old",
    ...overrides
  };
}

describe("mergeOffers", () => {
  it("adds new offers and preserves first seen dates for existing offers", () => {
    const result = mergeOffers([offer("existing")], [offer("existing", { rawSourceHash: "new" }), offer("new")], now);

    expect(result.find((item) => item.id === "existing")?.firstSeenAt).toBe("2026-06-01T00:00:00.000Z");
    expect(result.find((item) => item.id === "existing")?.lastSeenAt).toBe(now);
    expect(result.find((item) => item.id === "new")?.firstSeenAt).toBe(now);
  });

  it("marks missing active offers inactive without deleting them", () => {
    const result = mergeOffers([offer("missing")], [], now);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("inactive");
    expect(result[0].lastCheckedAt).toBe(now);
  });

  it("marks confidently expired offers expired", () => {
    const result = mergeOffers([], [offer("expired", { validUntil: "2026-01-01" })], now);
    expect(result[0].status).toBe("expired");
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm run test -- tests/ingest/categorize.test.ts tests/ingest/ingest.test.ts
```

Expected: FAIL because ingestion files do not exist.

- [ ] **Step 4: Implement categorization**

Create `lib/ingest/categorize.ts`:

```ts
import type { OfferCategory } from "@/lib/offers/types";

const categoryKeywords: Record<OfferCategory, string[]> = {
  dining: ["restaurant", "restaurants", "cafe", "coffee", "buffet", "food", "delivery", "dining"],
  travel: ["airline", "airport", "booking", "tour", "cruise", "transport", "travel"],
  hotels: ["hotel", "hotels", "resort", "villa", "stay", "room", "accommodation"],
  shopping: ["fashion", "electronics", "department store", "retail", "shopping"],
  supermarkets: ["supermarket", "grocery", "hypermarket"],
  fuel: ["fuel", "petrol", "diesel", "charging station"],
  health: ["hospital", "pharmacy", "clinic", "medical", "optical"],
  education: ["school", "university", "course", "institute", "academy", "education"],
  online: ["online", "ecommerce", "marketplace", "app", "website"],
  entertainment: ["cinema", "movie", "event", "theme park", "entertainment"],
  other: []
};

export function categorizeOfferText(text: string): OfferCategory {
  const normalized = text.toLowerCase();

  for (const [category, keywords] of Object.entries(categoryKeywords) as [OfferCategory, string[]][]) {
    if (category === "other") {
      continue;
    }

    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }

  return "other";
}
```

- [ ] **Step 5: Implement persistence merge**

Create `lib/ingest/persist.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Offer } from "@/lib/offers/types";

const dataPath = path.join(process.cwd(), "data", "offers.json");

function isExpired(offer: Offer, nowIso: string): boolean {
  if (!offer.validUntil) {
    return false;
  }

  const expiry = new Date(`${offer.validUntil}T23:59:59.999Z`);
  const now = new Date(nowIso);
  return Number.isFinite(expiry.getTime()) && expiry < now;
}

export function mergeOffers(existingOffers: Offer[], incomingOffers: Offer[], nowIso: string): Offer[] {
  const incomingById = new Map(incomingOffers.map((offer) => [offer.id, offer]));
  const existingById = new Map(existingOffers.map((offer) => [offer.id, offer]));
  const merged: Offer[] = [];

  for (const existing of existingOffers) {
    const incoming = incomingById.get(existing.id);

    if (!incoming) {
      merged.push({
        ...existing,
        status: existing.status === "expired" ? "expired" : "inactive",
        lastCheckedAt: nowIso
      });
      continue;
    }

    const nextOffer: Offer = {
      ...existing,
      ...incoming,
      firstSeenAt: existing.firstSeenAt,
      lastSeenAt: nowIso,
      lastCheckedAt: nowIso,
      status: isExpired(incoming, nowIso) ? "expired" : "auto_published"
    };

    merged.push(nextOffer);
  }

  for (const incoming of incomingOffers) {
    if (existingById.has(incoming.id)) {
      continue;
    }

    merged.push({
      ...incoming,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      lastCheckedAt: nowIso,
      status: isExpired(incoming, nowIso) ? "expired" : "auto_published"
    });
  }

  return merged.sort((a, b) => a.bankName.localeCompare(b.bankName) || a.title.localeCompare(b.title));
}

export async function readStoredOffers(): Promise<Offer[]> {
  try {
    const raw = await readFile(dataPath, "utf8");
    return JSON.parse(raw) as Offer[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function writeStoredOffers(offers: Offer[]): Promise<void> {
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, `${JSON.stringify(offers, null, 2)}\n`, "utf8");
}
```

- [ ] **Step 6: Run tests to verify pass**

Run:

```bash
npm run test -- tests/ingest/categorize.test.ts tests/ingest/ingest.test.ts
```

Expected: PASS with 6 tests.

- [ ] **Step 7: Commit**

Run:

```bash
git add lib/ingest/categorize.ts lib/ingest/persist.ts tests/ingest/categorize.test.ts tests/ingest/ingest.test.ts
git commit -m "feat: add ingestion categorization and persistence"
```

Expected: commit succeeds.

---

### Task 5: Add Source Registry And Refresh Script

**Files:**
- Create: `lib/sources/bankSources.ts`
- Create: `lib/ingest/extractHtmlOffers.ts`
- Create: `lib/ingest/ingest.ts`
- Create: `scripts/refresh-offers.ts`

- [ ] **Step 1: Create source registry**

Create `lib/sources/bankSources.ts`:

```ts
import type { SourceType } from "@/lib/offers/types";

export interface BankSource {
  bankId: string;
  bankName: string;
  shortName: string;
  enabled: boolean;
  sourceType: SourceType;
  urls: string[];
}

export const bankSources: BankSource[] = [
  { bankId: "hnb", bankName: "Hatton National Bank", shortName: "HNB", enabled: true, sourceType: "static_html", urls: ["https://www.hnb.net/personal/cards/credit-cards/offers"] },
  { bankId: "commercial-bank", bankName: "Commercial Bank of Ceylon", shortName: "Commercial Bank", enabled: true, sourceType: "static_html", urls: ["https://www.combank.lk/cards/promotions"] },
  { bankId: "cdb", bankName: "Citizens Development Business Finance", shortName: "CDB", enabled: true, sourceType: "static_html", urls: ["https://www.cdb.lk/cards/promotions"] },
  { bankId: "ndb", bankName: "National Development Bank", shortName: "NDB", enabled: true, sourceType: "static_html", urls: ["https://www.ndbbank.com/cards/offers"] },
  { bankId: "peoples-bank", bankName: "People's Bank", shortName: "People's Bank", enabled: true, sourceType: "static_html", urls: ["https://www.peoplesbank.lk/cards/offers"] },
  { bankId: "nsb", bankName: "National Savings Bank", shortName: "NSB", enabled: true, sourceType: "static_html", urls: ["https://www.nsb.lk/cards"] },
  { bankId: "boc", bankName: "Bank of Ceylon", shortName: "BOC", enabled: true, sourceType: "static_html", urls: ["https://www.boc.lk/cards/promotions"] },
  { bankId: "ntb", bankName: "Nations Trust Bank", shortName: "NTB", enabled: true, sourceType: "static_html", urls: ["https://www.nationstrust.com/cards/offers"] },
  { bankId: "sampath", bankName: "Sampath Bank", shortName: "Sampath", enabled: true, sourceType: "static_html", urls: ["https://www.sampath.lk/en/personal/cards/credit-cards/offers"] },
  { bankId: "dfcc", bankName: "DFCC Bank", shortName: "DFCC", enabled: true, sourceType: "static_html", urls: ["https://www.dfcc.lk/cards/offers"] }
];
```

- [ ] **Step 2: Implement HTML extraction**

Create `lib/ingest/extractHtmlOffers.ts`:

```ts
import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { categorizeOfferText } from "./categorize";
import type { Offer } from "@/lib/offers/types";
import type { BankSource } from "@/lib/sources/bankSources";

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function absoluteUrl(url: string | undefined, sourceUrl: string): string {
  if (!url) {
    return sourceUrl;
  }

  return new URL(url, sourceUrl).toString();
}

function stableId(source: BankSource, title: string, sourceUrl: string): string {
  const hash = crypto.createHash("sha1").update(`${source.bankId}|${title}|${sourceUrl}`).digest("hex").slice(0, 12);
  return `${source.bankId}-${hash}`;
}

function hashText(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex");
}

export function extractHtmlOffers(html: string, source: BankSource, sourceUrl: string, nowIso: string): Offer[] {
  const $ = cheerio.load(html);
  const candidates = $("article, .offer, .promotion, .promo, .card, li")
    .toArray()
    .map((element) => {
      const node = $(element);
      const text = cleanText(node.text());
      const title = cleanText(node.find("h1, h2, h3, h4, a").first().text()) || text.slice(0, 90);
      const link = absoluteUrl(node.find("a[href]").first().attr("href"), sourceUrl);

      return { text, title, link };
    })
    .filter((candidate) => candidate.title.length >= 8 && candidate.text.length >= 20)
    .slice(0, 80);

  const unique = new Map<string, Offer>();

  for (const candidate of candidates) {
    const id = stableId(source, candidate.title, candidate.link);

    unique.set(id, {
      id,
      bankId: source.bankId,
      bankName: source.bankName,
      title: candidate.title,
      category: categorizeOfferText(candidate.text),
      description: candidate.text.slice(0, 240),
      sourceUrl: candidate.link,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      lastCheckedAt: nowIso,
      status: "auto_published",
      rawSourceHash: hashText(candidate.text)
    });
  }

  return Array.from(unique.values());
}
```

- [ ] **Step 3: Implement refresh orchestration**

Create `lib/ingest/ingest.ts`:

```ts
import { extractHtmlOffers } from "./extractHtmlOffers";
import { mergeOffers, readStoredOffers, writeStoredOffers } from "./persist";
import { bankSources } from "@/lib/sources/bankSources";
import type { Offer } from "@/lib/offers/types";

export interface RefreshSummary {
  banksChecked: number;
  offersFound: number;
  offersSaved: number;
  failures: { bankId: string; url: string; message: string }[];
}

async function fetchSource(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "SLBankOffersBot/0.1 (+https://github.com/CSAbeywickrame/sl-bank-offers)"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

export async function refreshOffers(nowIso = new Date().toISOString()): Promise<RefreshSummary> {
  const existing = await readStoredOffers();
  const incoming: Offer[] = [];
  const failures: RefreshSummary["failures"] = [];
  let banksChecked = 0;

  for (const source of bankSources.filter((item) => item.enabled)) {
    banksChecked += 1;

    for (const url of source.urls) {
      try {
        const html = await fetchSource(url);
        incoming.push(...extractHtmlOffers(html, source, url, nowIso));
      } catch (error) {
        failures.push({
          bankId: source.bankId,
          url,
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  }

  const merged = mergeOffers(existing, incoming, nowIso);
  await writeStoredOffers(merged);

  return {
    banksChecked,
    offersFound: incoming.length,
    offersSaved: merged.length,
    failures
  };
}
```

- [ ] **Step 4: Create refresh command**

Create `scripts/refresh-offers.ts`:

```ts
import { refreshOffers } from "@/lib/ingest/ingest";

const summary = await refreshOffers();

console.log(JSON.stringify(summary, null, 2));

if (summary.failures.length > 0 && summary.offersFound === 0) {
  process.exitCode = 1;
}
```

- [ ] **Step 5: Verify script compiles with tests**

Run:

```bash
npm run test
```

Expected: all unit tests pass.

Run:

```bash
npm run build
```

Expected: production build succeeds.

- [ ] **Step 6: Run first refresh**

Run:

```bash
npm run refresh
```

Expected: command prints JSON with `banksChecked`, `offersFound`, `offersSaved`, and `failures`. Network or source failures are acceptable during early source tuning if the script completes and records failures.

- [ ] **Step 7: Commit**

Run:

```bash
git add lib/sources/bankSources.ts lib/ingest/extractHtmlOffers.ts lib/ingest/ingest.ts scripts/refresh-offers.ts data/offers.json
git commit -m "feat: add automated offer refresh"
```

Expected: commit succeeds.

---

### Task 6: Build Combined Offers Page

**Files:**
- Create: `components/FilterPanel.tsx`
- Create: `components/OfferCard.tsx`
- Create: `components/OfferGrid.tsx`
- Create: `components/EmptyState.tsx`
- Create: `components/BankCategoryNav.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create filter panel**

Create `components/FilterPanel.tsx`:

```tsx
import { banks } from "@/lib/offers/banks";
import { categories } from "@/lib/offers/categories";
import type { OfferCategory } from "@/lib/offers/types";

interface FilterPanelProps {
  selectedBankId?: string;
  selectedCategory?: OfferCategory;
  search?: string;
  actionPath?: string;
}

export function FilterPanel({ selectedBankId = "", selectedCategory, search = "", actionPath = "/" }: FilterPanelProps) {
  return (
    <form action={actionPath} className="grid gap-3 border-y border-slate-200 bg-white px-4 py-4 md:grid-cols-[1fr_1fr_2fr_auto]">
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Bank
        <select name="bank" defaultValue={selectedBankId} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm">
          <option value="">All banks</option>
          {banks.map((bank) => (
            <option key={bank.id} value={bank.id}>
              {bank.shortName}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Category
        <select name="category" defaultValue={selectedCategory ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm">
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Search
        <input name="search" defaultValue={search} placeholder="Search merchant, bank, or offer" className="h-11 rounded-md border border-slate-300 px-3 text-sm" />
      </label>

      <div className="flex items-end">
        <button className="h-11 w-full rounded-md bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800" type="submit">
          Filter
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create offer card and grid**

Create `components/OfferCard.tsx`:

```tsx
import { getCategoryLabel } from "@/lib/offers/categories";
import type { Offer } from "@/lib/offers/types";

function formatDate(value: string | undefined): string {
  if (!value) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export function OfferCard({ offer }: { offer: Offer }) {
  return (
    <article className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">{offer.bankName}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{getCategoryLabel(offer.category)}</span>
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">{offer.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{offer.description}</p>
      </div>

      <dl className="grid gap-2 text-sm text-slate-600">
        {offer.merchant ? <div><dt className="font-semibold text-slate-800">Merchant</dt><dd>{offer.merchant}</dd></div> : null}
        <div><dt className="font-semibold text-slate-800">Valid until</dt><dd>{formatDate(offer.validUntil)}</dd></div>
        <div><dt className="font-semibold text-slate-800">Last checked</dt><dd>{formatDate(offer.lastCheckedAt)}</dd></div>
      </dl>

      <a className="inline-flex h-10 items-center justify-center rounded-md border border-teal-700 px-4 text-sm font-semibold text-teal-800 hover:bg-teal-50" href={offer.sourceUrl} target="_blank" rel="noreferrer">
        View at bank
      </a>
    </article>
  );
}
```

Create `components/OfferGrid.tsx`:

```tsx
import { OfferCard } from "./OfferCard";
import type { Offer } from "@/lib/offers/types";

export function OfferGrid({ offers }: { offers: Offer[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Create empty state and navigation**

Create `components/EmptyState.tsx`:

```tsx
export function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-slate-950">No matching offers</h2>
      <p className="mt-2 text-sm text-slate-600">Try another bank, category, or search term.</p>
    </div>
  );
}
```

Create `components/BankCategoryNav.tsx`:

```tsx
import Link from "next/link";
import { banks } from "@/lib/offers/banks";
import { categories } from "@/lib/offers/categories";

export function BankCategoryNav() {
  return (
    <nav className="grid gap-4 md:grid-cols-2" aria-label="Browse offers">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">Banks</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {banks.map((bank) => (
            <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-teal-700 hover:text-teal-800" href={`/banks/${bank.id}`} key={bank.id}>
              {bank.shortName}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">Categories</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-teal-700 hover:text-teal-800" href={`/categories/${category.id}`} key={category.id}>
              {category.label}
            </Link>
          ))}
        </div>
      </section>
    </nav>
  );
}
```

- [ ] **Step 4: Build combined page**

Replace `app/page.tsx` with:

```tsx
import { BankCategoryNav } from "@/components/BankCategoryNav";
import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { OfferGrid } from "@/components/OfferGrid";
import { isOfferCategory } from "@/lib/offers/categories";
import { filterOffers } from "@/lib/offers/filter";
import { getActiveOffers } from "@/lib/offers/repository";

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const bankId = firstParam(params.bank);
  const categoryParam = firstParam(params.category);
  const search = firstParam(params.search);
  const category = isOfferCategory(categoryParam) ? categoryParam : undefined;
  const offers = filterOffers(await getActiveOffers(), { bankId, category, search });

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950">Sri Lankan Bank Card Offers</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Compare credit card offers by bank and category. Use the official bank links to confirm final terms before using an offer.
          </p>
        </div>
      </section>

      <FilterPanel selectedBankId={bankId} selectedCategory={category} search={search} />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
        <BankCategoryNav />
        <p className="text-sm font-medium text-slate-600">{offers.length} active offers found</p>
        {offers.length > 0 ? <OfferGrid offers={offers} /> : <EmptyState />}
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Verify build**

Run:

```bash
npm run build
```

Expected: production build succeeds.

- [ ] **Step 6: Commit**

Run:

```bash
git add components/FilterPanel.tsx components/OfferCard.tsx components/OfferGrid.tsx components/EmptyState.tsx components/BankCategoryNav.tsx app/page.tsx
git commit -m "feat: build combined offers page"
```

Expected: commit succeeds.

---

### Task 7: Add Bank And Category Pages

**Files:**
- Create: `app/banks/[bankId]/page.tsx`
- Create: `app/categories/[category]/page.tsx`

- [ ] **Step 1: Create bank page**

Create `app/banks/[bankId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { OfferGrid } from "@/components/OfferGrid";
import { getBankById } from "@/lib/offers/banks";
import { isOfferCategory } from "@/lib/offers/categories";
import { filterOffers } from "@/lib/offers/filter";
import { getActiveOffers } from "@/lib/offers/repository";

interface BankPageProps {
  params: Promise<{ bankId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function BankPage({ params, searchParams }: BankPageProps) {
  const { bankId } = await params;
  const bank = getBankById(bankId);

  if (!bank) {
    notFound();
  }

  const query = await searchParams;
  const categoryParam = firstParam(query.category);
  const search = firstParam(query.search);
  const category = isOfferCategory(categoryParam) ? categoryParam : undefined;
  const offers = filterOffers(await getActiveOffers(), { bankId, category, search });

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-normal text-slate-950">{bank.shortName} credit card offers</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Browse active offers collected for {bank.name}. Open each official bank link to confirm final terms.</p>
      </section>

      <FilterPanel selectedBankId={bankId} selectedCategory={category} search={search} actionPath={`/banks/${bankId}`} />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
        <p className="text-sm font-medium text-slate-600">{offers.length} active offers found</p>
        {offers.length > 0 ? <OfferGrid offers={offers} /> : <EmptyState />}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Create category page**

Create `app/categories/[category]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { OfferGrid } from "@/components/OfferGrid";
import { getCategoryLabel, isOfferCategory } from "@/lib/offers/categories";
import { filterOffers } from "@/lib/offers/filter";
import { getActiveOffers } from "@/lib/offers/repository";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: categoryParam } = await params;

  if (!isOfferCategory(categoryParam)) {
    notFound();
  }

  const query = await searchParams;
  const bankId = firstParam(query.bank);
  const search = firstParam(query.search);
  const offers = filterOffers(await getActiveOffers(), { bankId, category: categoryParam, search });

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-normal text-slate-950">{getCategoryLabel(categoryParam)} card offers</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Browse {getCategoryLabel(categoryParam).toLowerCase()} offers across Sri Lankan banks.</p>
      </section>

      <FilterPanel selectedBankId={bankId} selectedCategory={categoryParam} search={search} actionPath={`/categories/${categoryParam}`} />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
        <p className="text-sm font-medium text-slate-600">{offers.length} active offers found</p>
        {offers.length > 0 ? <OfferGrid offers={offers} /> : <EmptyState />}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

Run:

```bash
npm run build
```

Expected: production build succeeds.

- [ ] **Step 4: Commit**

Run:

```bash
git add app/banks/[bankId]/page.tsx app/categories/[category]/page.tsx
git commit -m "feat: add bank and category pages"
```

Expected: commit succeeds.

---

### Task 8: Add Browser Verification

**Files:**
- Create: `tests/ui/home.spec.ts`

- [ ] **Step 1: Write Playwright tests**

Create `tests/ui/home.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("home page filters combined offers by bank and category", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sri Lankan Bank Card Offers" })).toBeVisible();
  await expect(page.getByText("Dining offer sample")).toBeVisible();
  await expect(page.getByText("Hotel offer sample")).toBeVisible();

  await page.getByLabel("Bank").selectOption("hnb");
  await page.getByLabel("Category").selectOption("dining");
  await page.getByRole("button", { name: "Filter" }).click();

  await expect(page).toHaveURL(/bank=hnb/);
  await expect(page.getByText("Dining offer sample")).toBeVisible();
  await expect(page.getByText("Hotel offer sample")).toHaveCount(0);
});

test("offer cards include official bank links", async ({ page }) => {
  await page.goto("/");

  const links = page.getByRole("link", { name: "View at bank" });
  await expect(links.first()).toBeVisible();
  await expect(links.first()).toHaveAttribute("href", /https:\/\//);
});

test("bank and category routes render scoped directories", async ({ page }) => {
  await page.goto("/banks/hnb");
  await expect(page.getByRole("heading", { name: "HNB credit card offers" })).toBeVisible();

  await page.goto("/categories/hotels");
  await expect(page.getByRole("heading", { name: "Hotels card offers" })).toBeVisible();
});
```

- [ ] **Step 2: Install Playwright browser binaries**

Run:

```bash
npx playwright install chromium
```

Expected: Chromium browser binary is installed successfully.

- [ ] **Step 3: Run browser tests**

Run:

```bash
npm run test:e2e
```

Expected: PASS on desktop and mobile projects.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run test
npm run build
```

Expected: unit tests pass and production build succeeds.

- [ ] **Step 5: Commit**

Run:

```bash
git add tests/ui/home.spec.ts
git commit -m "test: verify offers directory UI"
```

Expected: commit succeeds.

---

### Task 9: Create Daily Automation

**Files:**
- Modify only through the Codex automation tool after `npm run refresh` works locally.

- [ ] **Step 1: Confirm refresh command works**

Run:

```bash
npm run refresh
```

Expected: command prints a JSON summary. If all live sources fail, the summary still includes `failures` and exits with code 1 only when zero offers were found.

- [ ] **Step 2: Create Codex cron automation**

Use the Codex automation tool with:

```text
name: Refresh Sri Lankan bank card offers
kind: cron
executionEnvironment: local
schedule: daily
cwd: /Users/chaithikaabeywickrame/Desktop/Chaithika/Business/BIZTool/bank-offers
prompt: Run the Bank Offers refresh workflow. Execute npm run refresh, summarize banks checked, offers found, offers saved, and any source failures. If the refresh fails, report the command output and likely failing source.
```

Expected: automation is ACTIVE and points at the `bank-offers` project directory.

- [ ] **Step 3: Commit final state after automation setup notes**

Run:

```bash
git status --short
```

Expected: no source code changes are required for the automation itself. If any generated logs were created, keep them untracked unless they are intentionally part of the app.

---

## Self-Review

Spec coverage:

- Fully automated ingestion is covered by Tasks 4, 5, and 9.
- Source links, last checked dates, and expiry handling are covered by Tasks 2, 4, 5, and 6.
- Combined-page bank/category/search filtering is covered by Tasks 3, 6, and 8.
- Bank-specific and category-specific pages are covered by Task 7.
- Data trust behavior is covered by the required `View at bank` links and visible freshness fields in Task 6.
- Review fallback is preserved through the `needs_review` status in Task 2, without building a review dashboard in the MVP.

Plan consistency:

- The canonical offer type uses `bankId`, `category`, `sourceUrl`, `lastCheckedAt`, `validUntil`, and `status` consistently across repository, filters, ingestion, and UI.
- The first MVP uses JSON storage at `data/offers.json`, matching the approved design's lightweight storage direction.
- The daily automation is intentionally created after the refresh script works, so the scheduled job does not point at a missing command.
