'server-only';

import { createClient } from '@/lib/supabase/server';
import { getMarketScope } from '@/lib/market-intel/market-definition';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';

const LOOKBACK_DAYS = 30;
const MIN_DAYS_FOR_BASELINE = 7;
const Z_SCORE_THRESHOLD = 2;
// Same near-zero-baseline guard as lib/reports/metrics/growth.ts's
// buildGrowthMetric (kept as a local constant rather than importing from
// lib/reports/ - that module depends on this one, not the other way
// around). A strict `=== 0` check let a Rs 0.01 old price through and
// produce a percent-change in the thousands.
const MIN_BASELINE_PRICE = 0.01;

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export type OrderAnomaly = {
  date: string;
  revenue: number;
  expectedRange: [number, number];
  zScore: number;
  direction: 'spike' | 'drop';
};

// Z-score outlier detection on the seller's own daily revenue - a spike or
// drop more than 2 standard deviations from their own trailing baseline.
// Deliberately simple (not seasonal-adjusted): with 30 days of history,
// day-of-week seasonality can't be reliably separated from real signal
// anyway, so this flags "unusual for you," not "unusual for a Tuesday."
export async function detectOwnRevenueAnomalies(sellerId: string, reportingCurrency: string): Promise<OrderAnomaly[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ data, error }, fxRates] = await Promise.all([
    supabase
      .from('seller_orders')
      .select('order_date, total_amount, currency')
      .eq('seller_id', sellerId)
      .gte('order_date', cutoff),
    getLatestFxRates(),
  ]);

  if (error || !data) return [];

  const byDate = new Map<string, number>();
  for (const row of data) {
    const date = row.order_date.slice(0, 10);
    const amount = convertCurrency(Number(row.total_amount), row.currency, reportingCurrency, fxRates);
    byDate.set(date, (byDate.get(date) ?? 0) + amount);
  }

  const series = Array.from(byDate.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (series.length < MIN_DAYS_FOR_BASELINE) return [];

  const revenues = series.map((s) => s.revenue);
  const avg = mean(revenues);
  const sd = stdDev(revenues, avg);
  if (sd === 0) return [];

  const anomalies: OrderAnomaly[] = [];
  for (const point of series) {
    const zScore = (point.revenue - avg) / sd;
    if (Math.abs(zScore) >= Z_SCORE_THRESHOLD) {
      anomalies.push({
        date: point.date,
        revenue: point.revenue,
        expectedRange: [Math.max(0, Math.round(avg - Z_SCORE_THRESHOLD * sd)), Math.round(avg + Z_SCORE_THRESHOLD * sd)],
        zScore: Number(zScore.toFixed(2)),
        direction: zScore > 0 ? 'spike' : 'drop',
      });
    }
  }

  return anomalies.sort((a, b) => b.date.localeCompare(a.date));
}

export type CompetitorPriceAnomaly = {
  productId: string;
  title: string;
  platformName: string | null;
  oldPrice: number;
  newPrice: number;
  pctChange: number;
};

const PRICE_HISTORY_LOOKBACK_DAYS = 7;

// IQR outlier detection on week-over-week % price changes across every
// product in the category - flags moves that are unusual relative to how
// volatile this specific category actually is, rather than a fixed
// percentage threshold (which would over-flag in a volatile category like
// electronics during a sale event, and under-flag in a stable one).
export async function detectCompetitorPriceAnomalies(
  categorySlug: string,
  reportingCurrency = 'PKR',
): Promise<CompetitorPriceAnomaly[]> {
  const scope = await getMarketScope(categorySlug);
  if (scope.categorySlugs.length === 0) return [];

  const supabase = await createClient();
  const cutoff = new Date(Date.now() - PRICE_HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const fxRates = await getLatestFxRates();

  const { data: products, error: productsError } = await supabase
    .from('market_products')
    .select('id, title, category_slug, price, currency, market_platforms(name)')
    .eq('is_active', true)
    .not('price', 'is', null)
    .in('category_slug', scope.categorySlugs)
    .in('platform_id', scope.activePlatformIds);

  if (productsError || !products) return [];

  // The scope filter now lives in the query above (`.in('category_slug', …)`),
  // so every returned row is already inside the seller's market definition.
  const matched = products;
  if (matched.length === 0) return [];

  const { data: history, error: historyError } = await supabase
    .from('market_price_history')
    .select('product_id, price, recorded_at')
    .in(
      'product_id',
      matched.map((p) => p.id),
    )
    .lte('recorded_at', cutoff)
    .not('price', 'is', null)
    .order('recorded_at', { ascending: false });

  if (historyError || !history) return [];

  const oldestPriceByProduct = new Map<string, number>();
  for (const row of history) {
    if (!oldestPriceByProduct.has(row.product_id)) oldestPriceByProduct.set(row.product_id, Number(row.price));
  }

  const changes: { product: (typeof matched)[number]; oldPrice: number; newPrice: number; pctChange: number }[] = [];
  for (const product of matched) {
    const rawOldPrice = oldestPriceByProduct.get(product.id);
    if (rawOldPrice == null || Math.abs(rawOldPrice) < MIN_BASELINE_PRICE || product.price == null) continue;
    // Convert after computing pctChange in native currency (a ratio, so
    // conversion doesn't change it) - oldPrice/newPrice are then converted
    // for display alongside the rest of the market-intel dashboard.
    const pctChange = ((Number(product.price) - rawOldPrice) / rawOldPrice) * 100;
    const productCurrency = product.currency ?? 'PKR';
    changes.push({
      product,
      oldPrice: convertCurrency(rawOldPrice, productCurrency, reportingCurrency, fxRates),
      newPrice: convertCurrency(Number(product.price), productCurrency, reportingCurrency, fxRates),
      pctChange,
    });
  }

  if (changes.length < MIN_DAYS_FOR_BASELINE) return [];

  const sortedChanges = [...changes.map((c) => c.pctChange)].sort((a, b) => a - b);
  const q1 = sortedChanges[Math.floor(sortedChanges.length * 0.25)];
  const q3 = sortedChanges[Math.floor(sortedChanges.length * 0.75)];
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  return changes
    .filter((c) => c.pctChange < lowerFence || c.pctChange > upperFence)
    .map((c) => {
      const platform = Array.isArray(c.product.market_platforms) ? c.product.market_platforms[0] : c.product.market_platforms;
      return {
        productId: c.product.id,
        title: c.product.title,
        platformName: platform?.name ?? null,
        oldPrice: c.oldPrice,
        newPrice: c.newPrice,
        pctChange: Number(c.pctChange.toFixed(1)),
      };
    })
    .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
}
