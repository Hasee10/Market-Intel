export interface RawProduct {
  externalId: string;
  categorySlug?: string;
  title: string;
  brand?: string;
  url: string;
  imageUrl?: string;
  galleryUrls?: string[];
  currency?: string;
  price?: number;
  compareAtPrice?: number;
  inStock?: boolean;
  rating?: number;
  ratingCount?: number;
}

export interface SourceResult {
  platformSlug: string;
  products: RawProduct[];
}

export type SourceFn = () => Promise<SourceResult>;

// Classifieds (e.g. OLX) - one-off asking-price listings, not a stable
// product being repriced by a fixed seller. Written to
// market_classified_listings/market_classified_price_history instead of
// market_products/market_price_history - see migrations/007.
export interface RawClassifiedListing {
  externalId: string;
  categorySlug?: string;
  title: string;
  url: string;
  imageUrl?: string;
  currency?: string;
  price?: number;
  condition?: string;
  city?: string;
  sellerType?: string;
  postedAt?: string;
}

export interface ClassifiedSourceResult {
  platformSlug: string;
  listings: RawClassifiedListing[];
}

export type ClassifiedSourceFn = () => Promise<ClassifiedSourceResult>;
