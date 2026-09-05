'server-only';

import { createClient } from '@/lib/supabase/server';
import { getMarketScope } from '@/lib/market-intel/market/market-definition';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';

export type PriceTrendPoint = { date: string; medianPrice: number };

const TREND_LOOKBACK_DAYS = 30;

// Daily median price across every scraped competitor product inside the
// seller's market definition, over the last 30 days - market_price_history
// already collects this on every scrape run, nothing surfaced it until now.
//
// Computed by market_scope_price_trend() in Postgres (ROADMAP.md A4, migration
// 021). This one genuinely needed moving: it used to select every matching
// product id, then pass that entire array back in as an `.in()` filter on
// market_price_history - a request whose URL length grew with the size of the
// seller's market, over the fastest-growing table in the schema.
export async function getPriceTrend(categorySlug: string, reportingCurrency = 'PKR'): Promise<PriceTrendPoint[]> {
  const scope = await getMarketScope(categorySlug);
  if (scope.categorySlugs.length === 0) return [];

  const supabase = await createClient();
  const fxRates = await getLatestFxRates();

  const { data, error } = await supabase.rpc('market_scope_price_trend', {
    p_category_slugs: scope.categorySlugs,
    p_platform_ids: scope.activePlatformIds,
    p_target_currency: reportingCurrency,
    p_rates: fxRates,
    p_lookback_days: TREND_LOOKBACK_DAYS,
  });

  if (error || !data) return [];

  return (data as { bucket_date: string; median_price: number | string | null }[])
    .filter((row) => row.median_price != null)
    .map((row) => ({ date: row.bucket_date, medianPrice: Number(row.median_price) }));
}

export type StockOutProduct = {
  id: string;
  title: string;
  platformName: string | null;
  price: number | null;
  url: string;
  /** Scraped listing image; nullable, and ProductThumb falls back to a tile. */
  imageUrl: string | null;
  lastSeenAt: string;
};

// Competitors currently showing as out of stock in this category - a signal
// a seller can use to pick up slack demand while a competitor is unable to
// fulfil.
export async function getStockOuts(categorySlug: string, limit = 10, reportingCurrency = 'PKR'): Promise<StockOutProduct[]> {
  const scope = await getMarketScope(categorySlug);
  if (scope.categorySlugs.length === 0) return [];

  const supabase = await createClient();
  const [{ data, error }, fxRates] = await Promise.all([
    supabase
      .from('market_products')
      .select('id, title, price, currency, url, image_url, category_slug, last_seen_at, market_platforms(name)')
      .eq('is_active', true)
      .eq('in_stock', false)
      .in('category_slug', scope.categorySlugs)
      .in('platform_id', scope.activePlatformIds)
      .order('last_seen_at', { ascending: false })
      .limit(200),
    getLatestFxRates(),
  ]);

  if (error || !data) return [];

  return data
    .slice(0, limit)
    .map((row) => {
      const platform = Array.isArray(row.market_platforms) ? row.market_platforms[0] : row.market_platforms;
      return {
        id: row.id,
        title: row.title,
        imageUrl: row.image_url ?? null,
        platformName: platform?.name ?? null,
        price: row.price != null ? convertCurrency(Number(row.price), row.currency ?? 'PKR', reportingCurrency, fxRates) : null,
        url: row.url,
        lastSeenAt: row.last_seen_at,
      };
    });
}

export type PlatformFreshness = { platformName: string; lastScrapedAt: string };

// Data-freshness indicator - the scraper runs every 2 days (see
// .github/workflows/market-scraper.yml), so this tells a seller how current
// the pricing/stock data they're looking at actually is, per platform.
export async function getDataFreshness(categorySlug: string): Promise<PlatformFreshness[]> {
  const scope = await getMarketScope(categorySlug);
  if (scope.categorySlugs.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('market_products')
    .select('category_slug, last_seen_at, market_platforms(name)')
    .eq('is_active', true)
    .in('category_slug', scope.categorySlugs)
    .in('platform_id', scope.activePlatformIds);

  if (error || !data) return [];

  const latestByPlatform = new Map<string, string>();
  for (const row of data) {
    const platform = Array.isArray(row.market_platforms) ? row.market_platforms[0] : row.market_platforms;
    if (!platform?.name) continue;
    const current = latestByPlatform.get(platform.name);
    if (!current || row.last_seen_at > current) latestByPlatform.set(platform.name, row.last_seen_at);
  }

  return Array.from(latestByPlatform.entries())
    .map(([platformName, lastScrapedAt]) => ({ platformName, lastScrapedAt }))
    .sort((a, b) => b.lastScrapedAt.localeCompare(a.lastScrapedAt));
}

export type DemandSignal = {
  activeListings: number;
  newListingsLast7Days: number;
  newListingsPrior7Days: number;
};

const DEMAND_WINDOW_DAYS = 7;

// OLX classifieds volume/velocity as a demand signal, distinct from
// market_products pricing - OLX is peer-to-peer asking prices, not a
// repriced catalog (see 007_create_olx_classifieds_tables.sql), so listing
// volume/velocity is what's meaningful here, not price percentiles.
export async function getDemandSignal(categorySlug: string): Promise<DemandSignal | null> {
  const scope = await getMarketScope(categorySlug);
  if (scope.categorySlugs.length === 0) return null;

  const supabase = await createClient();
  const { data: matched, error } = await supabase
    .from('market_classified_listings')
    .select('first_seen_at')
    .eq('status', 'active')
    .in('category_slug', scope.categorySlugs)
    .in('platform_id', scope.activePlatformIds);

  if (error || !matched) return null;
  if (matched.length === 0) return null;

  const now = Date.now();
  const last7 = now - DEMAND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const prior7 = now - 2 * DEMAND_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  let newListingsLast7Days = 0;
  let newListingsPrior7Days = 0;
  for (const row of matched) {
    const seenAt = new Date(row.first_seen_at).getTime();
    if (seenAt >= last7) newListingsLast7Days += 1;
    else if (seenAt >= prior7) newListingsPrior7Days += 1;
  }

  return { activeListings: matched.length, newListingsLast7Days, newListingsPrior7Days };
}
