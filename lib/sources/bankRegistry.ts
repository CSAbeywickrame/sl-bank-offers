/**
 * Bank Registry — THE single source of truth for which banks to scrape.
 *
 * To add a bank:   append a new BankRegistryEntry with `enabled: true`.
 * To remove a bank: set `enabled: false` (the orchestrator will remove its rows
 *                   once on the next run) or delete the entry entirely (orphan
 *                   reconciliation will prune it from the catalog).
 *
 * `defaultCardId` is the card that new scraped offers attach to by default.
 *
 * If a bank's page is JS-rendered and yields empty content when scraped as
 * static HTML, change its source `type` to `"dynamic_page"`.
 */

import type { Bank, Card } from "@/lib/offers/types";
import type { CrawlRecipe } from "@/lib/ingest/crawlBank";

export type RegistrySourceType = "static_html" | "feed" | "pdf" | "image" | "dynamic_page";

export interface RegistrySource {
  url: string;
  type: RegistrySourceType;
  crawl?: CrawlRecipe; // when set, the orchestrator crawls detail pages instead of extracting this page directly
}

export interface BankRegistryEntry {
  bankId: string;
  enabled: boolean;
  bank: Bank;
  cards: Card[];
  defaultCardId: string;
  sources: RegistrySource[];
  // Extra hostnames (lowercase) whose PDF/image assets may be ingested alongside the bank's own
  // origin — for banks that serve offer creatives from a CDN/object-store host.
  assetHosts?: string[];
  // Default true; set false to skip image/PDF auto-discovery for this bank.
  scanAssets?: boolean;
  // Default true; set false to skip the listing-page text-extraction Claude call for this bank.
  extractPageText?: boolean;
}

export const bankRegistry: BankRegistryEntry[] = [
  {
    bankId: "commercial-bank",
    enabled: true,
    bank: {
      id: "commercial-bank",
      name: "Commercial Bank of Ceylon",
      shortName: "Commercial Bank",
      websiteUrl: "https://www.combank.lk"
    },
    cards: [
      { id: "commercial-bank-credit-cards", bankId: "commercial-bank", name: "Commercial Bank Credit Cards", network: "Visa / Mastercard" },
      { id: "commercial-bank-premium-credit-cards", bankId: "commercial-bank", name: "Commercial Bank Premium Credit Cards", network: "Visa / Mastercard", tier: "Premium" },
      { id: "commercial-bank-platinum-debit-cards", bankId: "commercial-bank", name: "Commercial Bank Platinum Debit Cards", network: "Visa / Mastercard", tier: "Platinum" }
    ],
    defaultCardId: "commercial-bank-credit-cards",
    assetHosts: ["s3.ap-southeast-1.amazonaws.com"],
    // Listing -> per-offer /rewards-promotion/<category>/<slug> detail pages (singular "promotion"; static + rich).
    sources: [{
      url: "https://www.combank.lk/rewards-promotions",
      type: "static_html",
      crawl: { hops: [], detailMatch: "/rewards-promotion/[^/]+/[^/]+" }
    }]
  },
  {
    bankId: "ndb",
    enabled: true,
    bank: {
      id: "ndb",
      name: "National Development Bank",
      shortName: "NDB",
      websiteUrl: "https://www.ndbbank.com"
    },
    cards: [
      { id: "ndb-credit-cards", bankId: "ndb", name: "NDB Credit Cards", network: "Visa / Mastercard" },
      { id: "ndb-premium-credit-cards", bankId: "ndb", name: "NDB Platinum, Signature and Infinite Credit Cards", network: "Visa / Mastercard", tier: "Premium" }
    ],
    defaultCardId: "ndb-credit-cards",
    sources: [{ url: "https://www.ndbbank.com/cards/card-offers", type: "static_html" }]
  },
  {
    bankId: "boc",
    enabled: true,
    bank: {
      id: "boc",
      name: "Bank of Ceylon",
      shortName: "BOC",
      websiteUrl: "https://www.boc.lk"
    },
    cards: [
      { id: "boc-credit-cards", bankId: "boc", name: "BOC Credit Cards", network: "Visa / Mastercard" }
    ],
    defaultCardId: "boc-credit-cards",
    // Listing lists every offer as /personal-banking/card-offers/<category>/<merchant>/product (static + rich).
    sources: [{
      url: "https://www.boc.lk/personal-banking/card-offers",
      type: "static_html",
      crawl: { hops: [], detailMatch: "/personal-banking/card-offers/.+/product" }
    }]
  },
  {
    bankId: "peoples-bank",
    enabled: true,
    bank: {
      id: "peoples-bank",
      name: "People's Bank",
      shortName: "People's Bank",
      websiteUrl: "https://www.peoplesbank.lk"
    },
    cards: [
      { id: "peoples-bank-credit-cards", bankId: "peoples-bank", name: "People's Bank Credit Cards", network: "Visa / Mastercard" }
    ],
    defaultCardId: "peoples-bank-credit-cards",
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
  },
  {
    bankId: "ntb",
    enabled: true,
    bank: {
      id: "ntb",
      name: "Nations Trust Bank",
      shortName: "NTB",
      websiteUrl: "https://www.nationstrust.com"
    },
    cards: [
      { id: "ntb-mastercard-credit-cards", bankId: "ntb", name: "Nations Trust Bank Mastercard Credit Cards", network: "Mastercard" },
      { id: "ntb-private-banking-mastercard-credit-cards", bankId: "ntb", name: "Nations Trust Bank Private Banking Mastercard Credit Cards", network: "Mastercard", tier: "Private Banking" }
    ],
    defaultCardId: "ntb-mastercard-credit-cards",
    // Flat listing -> per-offer /promotions/<slug> detail pages (static + rich). A stray T&C page yields no offer.
    sources: [{
      url: "https://www.nationstrust.com/promotions",
      type: "static_html",
      crawl: { hops: [], detailMatch: "/promotions/[^/]+" }
    }]
  },
  {
    bankId: "pan-asia-bank",
    enabled: true,
    bank: {
      id: "pan-asia-bank",
      name: "Pan Asia Bank",
      shortName: "Pan Asia Bank",
      websiteUrl: "https://www.pabcbank.com"
    },
    cards: [
      { id: "pan-asia-bank-credit-cards", bankId: "pan-asia-bank", name: "Pan Asia Bank Credit Cards" }
    ],
    defaultCardId: "pan-asia-bank-credit-cards",
    // Whole site is behind a WAF that 307s plain HTTP; only a real browser gets through.
    sources: [{ url: "https://www.pabcbank.com/card-offers/", type: "dynamic_page" }]
  },
  {
    bankId: "standard-chartered",
    enabled: true,
    bank: {
      id: "standard-chartered",
      name: "Standard Chartered Sri Lanka",
      shortName: "Standard Chartered",
      websiteUrl: "https://www.sc.com/lk"
    },
    cards: [
      { id: "standard-chartered-credit-cards", bankId: "standard-chartered", name: "Standard Chartered Credit Cards", network: "Visa / Mastercard" }
    ],
    defaultCardId: "standard-chartered-credit-cards",
    sources: [{ url: "https://www.sc.com/lk/data/tgl/offers.json", type: "feed" }]
  },
  {
    bankId: "union-bank",
    enabled: true,
    bank: {
      id: "union-bank",
      name: "Union Bank of Colombo",
      shortName: "Union Bank",
      websiteUrl: "https://www.unionb.com"
    },
    cards: [
      { id: "union-bank-credit-cards", bankId: "union-bank", name: "Union Bank Credit Cards", network: "Visa / Mastercard" }
    ],
    defaultCardId: "union-bank-credit-cards",
    // NOTE: unionb.com is a bot-protected SPA — it returns an empty shell to both plain HTTP and
    // headless Playwright, so it cannot be auto-scraped yet. Left enabled so its existing offers are
    // PRESERVED (a failed/empty fetch keeps rows); it will report skipped-empty each run until a
    // working approach is found. Do NOT set enabled:false (that would delete its offers).
    sources: [
      { url: "https://www.unionb.com/credit-cards-offers/", type: "static_html" },
      { url: "https://www.unionb.com/credit-cards-offers/page/2/", type: "static_html" }
    ]
  },
  {
    bankId: "cargills-bank",
    enabled: true,
    bank: {
      id: "cargills-bank",
      name: "Cargills Bank",
      shortName: "Cargills Bank",
      websiteUrl: "https://www.cargillsbank.com"
    },
    cards: [
      { id: "cargills-bank-mastercard-credit-cards", bankId: "cargills-bank", name: "Cargills Bank Mastercard Credit Cards", network: "Mastercard" }
    ],
    defaultCardId: "cargills-bank-mastercard-credit-cards",
    // Offers live only in flyer JPEGs on these two listing pages (page text is nav-menu chrome) — skip
    // the listing-page text-extraction call and rely on auto-discovered image assets instead.
    extractPageText: false,
    sources: [
      { url: "https://www.cargillsbank.com/products/cargills-bank-cards-promotions/", type: "static_html" },
      { url: "https://www.cargillsbank.com/products/mastercard-promotions/", type: "static_html" }
    ]
  },
  {
    bankId: "sampath",
    enabled: true,
    bank: {
      id: "sampath",
      name: "Sampath Bank",
      shortName: "Sampath",
      websiteUrl: "https://www.sampath.lk"
    },
    cards: [
      { id: "sampath-credit-cards", bankId: "sampath", name: "Sampath Credit Cards", network: "Visa / Mastercard / American Express" },
      { id: "sampath-premium-credit-cards", bankId: "sampath", name: "Sampath Visa Infinite, Visa Signature and Mastercard World Credit Cards", network: "Visa / Mastercard", tier: "Premium" }
    ],
    defaultCardId: "sampath-credit-cards",
    // Structured JSON API (one call returns all offers). Parsed deterministically by feedMappers["sampath"]
    // (no LLM). The page itself is a bot-blocked Nuxt SPA, so HTML scraping does not work.
    sources: [{ url: "https://www.sampath.lk/api/card-promotions?page_number=1&size=300", type: "feed" }]
  },
  {
    bankId: "dfcc",
    enabled: true,
    bank: {
      id: "dfcc",
      name: "DFCC Bank",
      shortName: "DFCC",
      websiteUrl: "https://www.dfcc.lk"
    },
    cards: [
      { id: "dfcc-credit-cards", bankId: "dfcc", name: "DFCC Credit Cards", network: "Visa / Mastercard" }
    ],
    defaultCardId: "dfcc-credit-cards",
    sources: [
      { url: "https://www.dfcc.lk/cards/card-offers", type: "static_html" }, 
      { url: "https://www.dfcc.lk/cards/credit-card-offers", type: "static_html" },
      { url: "https://www.dfcc.lk/cards/cards/mastercard-offers", type: "static_html" },
      { url: "https://www.dfcc.lk/cards/cards/visa-offers", type: "static_html" }]
  },
  {
    bankId: "seylan",
    enabled: true,
    bank: {
      id: "seylan",
      name: "Seylan Bank",
      shortName: "Seylan",
      websiteUrl: "https://www.seylan.lk"
    },
    cards: [
      { id: "seylan-credit-cards", bankId: "seylan", name: "Seylan Credit Cards", network: "Visa / Mastercard" }
    ],
    defaultCardId: "seylan-credit-cards",
    // Full paginated credit-card catalog (23 pages behind an ellipsis pager) -> each promo is a
    // root-level slug linked as <a class="btn new-promotion-btn">READ MORE</a>, not a URL-pattern-matchable
    // path, so detail links are read by class selector and the pager is walked page-by-page.
    sources: [{
      url: "https://www.seylan.lk/promotions/cards?type[]=credit_card",
      type: "static_html",
      crawl: {
        hops: [],
        detailSelector: "a.new-promotion-btn",
        paginateNextSelector: "a.page-link[rel=next]",
      },
    }],
    scanAssets: false,
  },
  // NOTE: NSB is a new bank not yet in seed.json
  {
    bankId: "nsb",
    enabled: true,
    bank: {
      id: "nsb",
      name: "National Savings Bank",
      shortName: "NSB",
      websiteUrl: "https://www.nsb.lk"
    },
    cards: [
      { id: "nsb-mastercard-debit-cards", bankId: "nsb", name: "NSB Mastercard Debit Cards", network: "Mastercard" }
    ],
    defaultCardId: "nsb-mastercard-debit-cards",
    // WordPress category, paginated (3 pages as of 2026-06). Each paginated page is a crawl seed; offer
    // posts are /<slug>/ permalinks whose slug contains "nsb…card" (excludes nav links). Add/remove page URLs as the list grows.
    sources: [
      { url: "https://www.nsb.lk/category/card-offers/", type: "static_html", crawl: { hops: [], detailMatch: "[a-z0-9-]*nsb[a-z0-9-]*card" } },
      { url: "https://www.nsb.lk/category/card-offers/page/2/", type: "static_html", crawl: { hops: [], detailMatch: "[a-z0-9-]*nsb[a-z0-9-]*card" } },
      { url: "https://www.nsb.lk/category/card-offers/page/3/", type: "static_html", crawl: { hops: [], detailMatch: "[a-z0-9-]*nsb[a-z0-9-]*card" } }
    ]
  }
];

// Returns only enabled bank registry entries
export function getEnabledBanks(): BankRegistryEntry[] {
  return bankRegistry.filter((b) => b.enabled);
}
