// What an offer is FOR — the merchant's vertical. Ordered by catalog size so the filter and the
// category index lead with what most offers actually are.
//
// How an offer pays out lives in `offerTypes` below, never here: an interest-free plan at an
// electronics store is `electronics` + `installment`. Keeping the two apart is what lets a shopper
// browse "hotels" without wading through every payment plan, and is why `installment`, `cashback`
// and `bogo` are no longer categories.
export const offerCategories = [
  "hotels",
  "dining",
  "home",
  "travel",
  "health",
  "fashion",
  "electronics",
  "automotive",
  "supermarket",
  "leisure",
  "online",
  "fuel",
  "other"
] as const;

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
  /**
   * Longest interest-free term an installment offer advertises, in months.
   *
   * An installment plan has no percentage off — the term IS the offer, and a third of the catalog
   * is one of these. Without it those offers have no headline a card can show.
   */
  installmentMonths?: number;
  minSpend?: number;
  maxDiscountAmount?: number;
  validDays?: Weekday[];
  cardNetworks?: CardNetwork[];
  cardTypes?: CardKind[];
  cardTiers?: CardTier[];
  eligibilityNote?: string;
}

// Supported offer list sort orders, in the order they should appear in a sort control
export const sortKeys = ["relevance", "newest", "expiring-soon", "biggest-discount"] as const;

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

// How soon an offer's window closes, or whether it has opened yet.
export const validityWindows = ["ends-3d", "ends-week", "ends-month", "not-started", "no-end"] as const;

export type ValidityWindow = (typeof validityWindows)[number];

// How recently an offer joined the catalog, measured from firstSeenAt.
export const addedWindows = ["7d", "30d"] as const;

export type AddedWindow = (typeof addedWindows)[number];

// Minimum-discount steps offered in the UI. Coarse on purpose: a shopper thinks "at least 20%",
// not "at least 23%".
export const discountFloors = [10, 20, 30, 50] as const;

export type DiscountFloor = (typeof discountFloors)[number];

export interface OfferFilters {
  bankId?: string;
  cardId?: string;
  category?: OfferCategory;
  search?: string;
  bankIds?: string[];
  categories?: OfferCategory[];
  offerTypes?: OfferType[];
  /** Keep offers advertising at least this percentage off. */
  minDiscountPct?: DiscountFloor;
  /** Keep offers valid on this weekday, including offers with no day restriction at all. */
  day?: Weekday;
  validity?: ValidityWindow;
  added?: AddedWindow;
  cardNetworks?: CardNetwork[];
  cardTypes?: CardKind[];
  cardTiers?: CardTier[];
}
