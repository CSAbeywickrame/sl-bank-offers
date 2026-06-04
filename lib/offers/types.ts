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
