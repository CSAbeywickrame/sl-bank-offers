export const offerCategories = ["dining", "fuel", "supermarket", "travel", "online", "installment", "cashback", "bogo", "other"] as const;

export type OfferCategory = (typeof offerCategories)[number];

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

export interface CatalogOffer {
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
}

export interface SeedData {
  banks: Bank[];
  cards: Card[];
  offers: CatalogOffer[];
}

export interface ScannedOffer {
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
}

export interface ScannedOfferCatalog {
  version: number;
  updatedAt: string;
  offers: ScannedOffer[];
}

export interface Offer {
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
