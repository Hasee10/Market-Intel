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
  // Seller identity behind the listing. Only marketplaces that name the
  // merchant can fill these (Daraz today); single-retailer sources leave them
  // undefined, since on those the platform *is* the seller. This is what makes
  // a competitor entity possible - see ROADMAP.md C1.
  sellerName?: string;
  sellerExternalId?: string;
  // Platform-reported units sold, coarse and rounded at source. A demand
  // *proxy*, not sales data - always label it as such downstream.
  soldCount?: number;
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
