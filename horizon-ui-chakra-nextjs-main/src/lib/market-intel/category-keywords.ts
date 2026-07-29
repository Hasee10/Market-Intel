'server-only';

// The scraper only covers a subset of seller_categories' 12 slugs so far
// (mobiles-and-electronics, fashion-and-apparel) - see scraper/.env category
// vars. Matched by keyword against market_products.category_slug (a raw
// per-platform string like "mobiles-tablets" or "ready-to-wear"), not an FK,
// since market_products lives in a separate scraper-owned namespace. Shared
// across every module that bridges a seller's category to scraped data
// (category-pricing, trends, stock-outs, freshness, demand-signal) so
// coverage expansion only needs updating in one place.
export const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  'mobiles-and-electronics': /mobile|laptop|computing|iphone|tablet|electronic/i,
  'fashion-and-apparel': /fashion|wear|unstitched|apparel|clothing/i,
};
