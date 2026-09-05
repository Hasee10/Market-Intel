'server-only';

import { createClient } from '@/lib/supabase/server';
import { getMarketScope } from '@/lib/market-intel/market/market-definition';
import { getLatestFxRates } from '@/lib/market-intel/fx';

export type CategoryPricing = {
  categorySlug: string;
  count: number;
  minPrice: number;
  // Null below MIN_SAMPLE_FOR_BAND (migration 026's sample-size guard inside
  // market_scope_price_stats itself, not just trusted at this layer) - a
  // percentile computed from a handful of rows is a guess dressed up as
  // precision. median/count/minPrice/maxPrice stay populated at any sample
  // size >= 1; only p25/p75 are gated.
  p25: number | null;
  median: number;
  p75: number | null;
  maxPrice: number;
  avgPrice: number;
  samplePlatforms: string[];
};

type PriceStatsRow = {
  row_count: number | string | null;
  min_price: number | string | null;
  p25: number | string | null;
  median: number | string | null;
  p75: number | string | null;
  max_price: number | string | null;
  avg_price: number | string | null;
  platform_names: string[] | null;
};

// Market-wide competitor pricing, sourced from the scraper's market_products
// table (retailer marketplaces: Priceoye, Telemart, Shophive, iShopping,
// Goto, SapphireOnline, Daraz) plus market_classified_listings (OLX) - unioned
// because several seller categories (beauty, grocery, home & kitchen,
// automotive, etc.) have no retailer-marketplace coverage at all yet, only
// OLX classifieds. Unrelated to domain_benchmarks (computed from our own
// sellers' opted-in data). Returns null if this seller's category has no
// taxonomy mapping yet, or no scraped/listed rows fall inside the seller's
// market definition.
//
// Scoped by getMarketScope() (ROADMAP.md A3) rather than by a category regex,
// so the median here is the median of the seller's *own* market - their
// segments, their price band, their brands - not of everything a pattern
// happened to sweep up.
//
// The distribution itself is computed by market_scope_price_stats() in
// Postgres (ROADMAP.md A4, migration 021) rather than by pulling every
// matching row into JS and sorting the array. Requires migration 021.
//
// targetCurrency converts every scraped row into one consistent currency
// before computing percentiles - every scraper here targets Pakistani
// sites so rows are almost always 'PKR', but a seller reporting in a
// different currency would otherwise see their own numbers (already
// converted) compared against raw PKR competitor prices.
export async function getCategoryPricing(sellerCategorySlug: string, targetCurrency: string): Promise<CategoryPricing | null> {
  const scope = await getMarketScope(sellerCategorySlug);
  if (scope.categorySlugs.length === 0) return null;

  const supabase = await createClient();
  const fxRates = await getLatestFxRates();

  const { data, error } = await supabase
    .rpc('market_scope_price_stats', {
      p_category_slugs: scope.categorySlugs,
      p_platform_ids: scope.activePlatformIds,
      p_target_currency: targetCurrency,
      p_rates: fxRates,
      p_band_currency: scope.definition.priceCurrency,
      p_price_min: scope.definition.priceMin,
      p_price_max: scope.definition.priceMax,
      p_brands: scope.definition.brands,
      p_cities: scope.definition.cities,
    })
    .maybeSingle<PriceStatsRow>();

  if (error || !data) return null;

  const count = Number(data.row_count ?? 0);
  // An empty scope aggregates to a single row of nulls, not to zero rows -
  // that is how `count(*)` with no GROUP BY behaves. Treat it as "no market".
  if (count === 0 || data.median == null) return null;

  return {
    categorySlug: sellerCategorySlug,
    count,
    minPrice: Number(data.min_price),
    // Number(null) is 0 in JS - must check for null explicitly, not just
    // coerce, now that the SQL function itself can withhold these below
    // its sample-size threshold.
    p25: data.p25 != null ? Number(data.p25) : null,
    median: Number(data.median),
    p75: data.p75 != null ? Number(data.p75) : null,
    maxPrice: Number(data.max_price),
    avgPrice: Number(data.avg_price),
    samplePlatforms: (data.platform_names ?? []).filter(Boolean).slice(0, 5),
  };
}
