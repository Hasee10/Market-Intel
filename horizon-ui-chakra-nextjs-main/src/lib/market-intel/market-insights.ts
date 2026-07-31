'server-only';

import { createClient } from '@/lib/supabase/server';
import { CATEGORY_KEYWORDS } from '@/lib/market-intel/category-keywords';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function getMatchedProductIds(categorySlug: string): Promise<string[]> {
  const keywordPattern = CATEGORY_KEYWORDS[categorySlug];
  if (!keywordPattern) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('market_products')
    .select('id, category_slug')
    .eq('is_active', true);

  if (error || !data) return [];

  return data.filter((row) => row.category_slug && keywordPattern.test(row.category_slug)).map((row) => row.id);
}

export type PriceTrendPoint = { date: string; medianPrice: number };

const TREND_LOOKBACK_DAYS = 30;

// Daily median price across every scraped competitor product in this
// seller's category, over the last 30 days - market_price_history already
// collects this on every scrape run, nothing surfaced it until now.
export async function getPriceTrend(categorySlug: string, reportingCurrency = 'PKR'): Promise<PriceTrendPoint[]> {
  const productIds = await getMatchedProductIds(categorySlug);
  if (productIds.length === 0) return [];

  const supabase = await createClient();
  const cutoff = new Date(Date.now() - TREND_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ data, error }, fxRates] = await Promise.all([
    supabase
      .from('market_price_history')
      .select('price, recorded_at, market_products(currency)')
      .in('product_id', productIds)
      .gte('recorded_at', cutoff)
      .not('price', 'is', null),
    getLatestFxRates(),
  ]);

  if (error || !data) return [];

  const byDate = new Map<string, number[]>();
  for (const row of data) {
    const date = row.recorded_at.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    const product = Array.isArray(row.market_products) ? row.market_products[0] : row.market_products;
    byDate.get(date)!.push(convertCurrency(Number(row.price), product?.currency ?? 'PKR', reportingCurrency, fxRates));
  }

  return Array.from(byDate.entries())
    .map(([date, prices]) => ({ date, medianPrice: median(prices) ?? 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type StockOutProduct = {
  id: string;
  title: string;
  platformName: string | null;
  price: number | null;
  url: string;
  lastSeenAt: string;
};

// Competitors currently showing as out of stock in this category - a signal
// a seller can use to pick up slack demand while a competitor is unable to
// fulfil.
export async function getStockOuts(categorySlug: string, limit = 10, reportingCurrency = 'PKR'): Promise<StockOutProduct[]> {
  const keywordPattern = CATEGORY_KEYWORDS[categorySlug];
  if (!keywordPattern) return [];

  const supabase = await createClient();
  const [{ data, error }, fxRates] = await Promise.all([
    supabase
      .from('market_products')
      .select('id, title, price, currency, url, category_slug, last_seen_at, market_platforms(name)')
      .eq('is_active', true)
      .eq('in_stock', false)
      .order('last_seen_at', { ascending: false })
      .limit(200),
    getLatestFxRates(),
  ]);

  if (error || !data) return [];

  return data
    .filter((row) => row.category_slug && keywordPattern.test(row.category_slug))
    .slice(0, limit)
    .map((row) => {
      const platform = Array.isArray(row.market_platforms) ? row.market_platforms[0] : row.market_platforms;
      return {
        id: row.id,
        title: row.title,
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
  const keywordPattern = CATEGORY_KEYWORDS[categorySlug];
  if (!keywordPattern) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('market_products')
    .select('category_slug, last_seen_at, market_platforms(name)')
    .eq('is_active', true);

  if (error || !data) return [];

  const latestByPlatform = new Map<string, string>();
  for (const row of data) {
    if (!row.category_slug || !keywordPattern.test(row.category_slug)) continue;
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
  const keywordPattern = CATEGORY_KEYWORDS[categorySlug];
  if (!keywordPattern) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('market_classified_listings')
    .select('category_slug, status, first_seen_at')
    .eq('status', 'active');

  if (error || !data) return null;

  const matched = data.filter((row) => row.category_slug && keywordPattern.test(row.category_slug));
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
