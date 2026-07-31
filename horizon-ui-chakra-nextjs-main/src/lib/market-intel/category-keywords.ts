'server-only';

// Maps a seller's category to scraped market data via keyword matching
// against category_slug (a raw per-platform string like "mobiles-tablets"
// or "skin-hair_c1972"), not an FK, since market_products/
// market_classified_listings live in a separate scraper-owned namespace.
// Shared across every module that bridges a seller's category to scraped
// data (category-pricing, trends, stock-outs, freshness, demand-signal) so
// coverage expansion only needs updating in one place.
//
// 10 of seller_categories' 12 slugs (011_create_seller_platform_tables.sql)
// have no retailer-marketplace coverage at all - Priceoye/Telemart/Shophive/
// iShopping/Goto only scrape electronics and fashion sections. OLX is the
// one source broad enough to cover the rest (verified live against each
// category path below before adding), so most of these patterns are matched
// against OLX classified_listings rows rather than market_products - see
// OLX_CATEGORIES in .github/workflows/market-scraper.yml for the scraped
// paths. "other" is an intentional catch-all with no mapping - there's no
// real-world category to point it at.
export const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  'mobiles-and-electronics':
    /mobile|laptop|computing|iphone|tablet|electronic|smart-watch|earbud|power-bank|speaker/i,
  'fashion-and-apparel': /fashion|wear|unstitched|apparel|clothing|fashion-beauty/i,
  'beauty-and-personal-care': /skin-hair|make-up|makeup|fragrance|bath-body|beauty|cosmetic/i,
  'coffee-and-beverages': /farm-fresh-food|food-restaurants|beverage|coffee/i,
  'grocery-and-food': /farm-fresh-food|food-restaurants|grocery/i,
  'home-and-kitchen': /furniture-home-decor|kitchen-appliances|kitchen-essentials|home-essentials|home-decor|furniture/i,
  'books-and-stationery': /books-magazines|stationery|books\b/i,
  'toys-and-baby': /toys\b|baby-gear|kids-clothing|kids\b/i,
  'sports-and-outdoors': /sports-equipment|gym-fitness|camping-hiking|outdoor/i,
  automotive: /spare-parts|motors|vehicles_c5|cars_c84|motorcycles|automotive/i,
  'health-and-wellness': /gym-fitness|health|wellness/i,
};
