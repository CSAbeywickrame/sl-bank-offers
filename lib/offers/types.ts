// The categories the app emits and renders today (extraction prompt, filter pills, category pages).
export const activeOfferCategories = ["dining", "fuel", "supermarket", "travel", "online", "installment", "cashback", "bogo", "other"] as const;

// Verticals staged for the taxonomy migration. Valid schema values already, so importers and
// enrichment can be built against them, but no offer carries one until the data migrates.
const migrationOfferCategories = ["hotels", "fashion", "electronics", "health", "home", "automotive", "leisure"] as const;

// Superset during the taxonomy migration: today's categories followed by the staged verticals.
// Shrinks back to a single taxonomy once the offer data migrates onto the new verticals.
export const offerCategories = [...activeOfferCategories, ...migrationOfferCategories] as const;

export type OfferCategory = (typeof offerCategories)[number];

// How an offer discounts. Parsed from offer text by lib/ingest/enrich.ts.
export const offerTypes = ["discount", "installment", "cashback", "bogo", "other"] as const;

export type OfferType = (typeof offerTypes)[number];

// Days an offer is valid on, in week order — the order parsers and UI must emit.
export const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type Weekday = (typeof weekdays)[number];

export const cardNetworks = ["visa", "mastercard", "amex", "unionpay", "jcb", "diners"] as const;

export type CardNetwork = (typeof cardNetworks)[number];

export const cardKinds = ["credit", "debit", "prepaid"] as const;

export type CardKind = (typeof cardKinds)[number];

// Named `cardTierValues` because `cardTiers` is the offer field that holds a subset of them.
export const cardTierValues = ["classic", "gold", "platinum", "signature", "infinite", "world", "premium", "corporate"] as const;

export type CardTier = (typeof cardTierValues)[number];

// Optional attributes parsed out of offer text by lib/ingest/enrich.ts. Every field stays optional:
// most offers only yield a few of them, and rows written before enrichment existed carry none.
export interface OfferEnrichment {
  offerType?: OfferType;
  discountPct?: number;
  discountLabel?: string;
  minSpend?: number;
  maxDiscountAmount?: number;
  validDays?: Weekday[];
  cardNetworks?: CardNetwork[];
  cardTypes?: CardKind[];
  cardTiers?: CardTier[];
  eligibilityNote?: string;
}

// Supported offer list sort orders, in the order they should appear in a sort control
export const sortKeys = ["relevance", "newest", "expiring-soon"] as const;

// A valid sort order for the offer list
export type SortKey = (typeof sortKeys)[number];

// The sort order applied when no sort is specified
export const DEFAULT_SORT: SortKey = "relevance";

export type OfferStatus = "active" | "inactive" | "expired" | "needs_review";

export type SourceType = "static_html" | "dynamic_page" | "feed" | "pdf_or_image" | "unknown";

export interface Bank {
  id: string;
  name: string;
  shortName: string;
  websiteUrl: string;
}

export interface Card {
  id: string;
  bankId: string;
  name: string;
  network?: string;
  tier?: string;
}

export interface CatalogOffer extends OfferEnrichment {
  id: string;
  cardId: string;
  title: string;
  category: OfferCategory;
  description: string;
  merchant?: string;
  location?: string;
  validFrom?: string;
  validUntil?: string;
  termsLink: string;
  sourceUrl: string;
  lastReviewedAt: string;
  status: OfferStatus;
  imageUrl?: string;
  // Set on first import and carried across refreshes, so "date added" survives a batch replace.
  firstSeenAt?: string;
}

export interface SeedData {
  banks: Bank[];
  cards: Card[];
  offers: CatalogOffer[];
}

export interface ScannedOffer extends OfferEnrichment {
  id: string;
  bankId: string;
  cardId: string;
  title: string;
  category: OfferCategory;
  description: string;
  merchant?: string;
  location?: string;
  validFrom?: string;
  validUntil?: string;
  termsLink: string;
  sourceUrl: string;
  lastReviewedAt: string;
  status: OfferStatus;
  imageUrl?: string;
  // Set on first import and carried across refreshes, so "date added" survives a batch replace.
  firstSeenAt?: string;
}

export interface ScannedOfferCatalog {
  version: number;
  updatedAt: string;
  offers: ScannedOffer[];
}

export interface Offer extends OfferEnrichment {
  id: string;
  bankId: string;
  bankName: string;
  bankShortName?: string;
  cardId?: string;
  cardName?: string;
  title: string;
  category: OfferCategory;
  description: string;
  merchant?: string;
  location?: string;
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
  cardId?: string;
  category?: OfferCategory;
  search?: string;
  bankIds?: string[];
  categories?: OfferCategory[];
}
