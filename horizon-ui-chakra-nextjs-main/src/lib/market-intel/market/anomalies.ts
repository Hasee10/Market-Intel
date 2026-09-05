'server-only';

import { createClient } from '@/lib/supabase/server';
import { getMarketScope } from '@/lib/market-intel/market/market-definition';
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

// An anomaly must hold across this many consecutive evaluations - today's
// plus (CYCLES - 1) prior ones - before it's surfaced to a user. Without
// this, one glitchy scrape (a mis-parsed price, a stale cache hit, a
// one-off bad order total) becomes an instant user-facing flag. Named so
// it's tunable later without touching the gating logic itself: the loops
// below already walk `cycle` from 0 to CYCLES - 1, so raising this to 3
// only requires enough underlying history to support the extra cycle.
export const ANOMALY_CONFIRMATION_CYCLES = 2;

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

type RevenuePoint = { date: string; revenue: number };

// Pure z-score pass over a revenue series - unchanged from the original
// implementation, just extracted so the confirmation gate below can run it
// against more than one window, and so it's unit-testable without a
// database. Exported for tests only.
export function computeRevenueAnomaliesFromSeries(series: RevenuePoint[]): OrderAnomaly[] {
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
  return anomalies;
}

// A date is confirmed only if it's still flagged when the series is
// re-evaluated with the most recent (cycle) days dropped, for every cycle
// up to ANOMALY_CONFIRMATION_CYCLES - 1. Since dropping days only ever
// removes from the tail, a date can only fail confirmation by being one of
// the most recent (CYCLES - 1) days - i.e. "fresh" flags wait one cycle,
// anomalies from earlier in the window are checked against a
// near-identical baseline both times. Fails closed (not confirmed) if
// there isn't enough history left to even run a prior-cycle evaluation.
function isRevenueAnomalyConfirmed(date: string, series: RevenuePoint[]): boolean {
  for (let cycle = 0; cycle < ANOMALY_CONFIRMATION_CYCLES; cycle += 1) {
    const windowSeries = cycle === 0 ? series : series.slice(0, series.length - cycle);
    if (windowSeries.length < MIN_DAYS_FOR_BASELINE) return false;
    if (!windowSeries.some((p) => p.date === date)) return false;
    const flagged = computeRevenueAnomaliesFromSeries(windowSeries).some((a) => a.date === date);
    if (!flagged) return false;
  }
  return true;
}

// Z-score outlier detection on the seller's own daily revenue - a spike or
// drop more than 2 standard deviations from their own trailing baseline.
// Deliberately simple (not seasonal-adjusted): with 30 days of history,
// day-of-week seasonality can't be reliably separated from real signal
// anyway, so this flags "unusual for you," not "unusual for a Tuesday."
// Gated by ANOMALY_CONFIRMATION_CYCLES (see isRevenueAnomalyConfirmed).
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

  const candidates = computeRevenueAnomaliesFromSeries(series);
  const confirmed = candidates.filter((a) => isRevenueAnomalyConfirmed(a.date, series));

  return confirmed.sort((a, b) => b.date.localeCompare(a.date));
}

export type CompetitorPriceAnomaly = {
  productId: string;
  title: string;
  platformName: string | null;
  /** Scraped listing image; nullable, and ProductThumb falls back to a tile. */
  imageUrl: string | null;
  oldPrice: number;
  newPrice: number;
  pctChange: number;
};

const PRICE_HISTORY_LOOKBACK_DAYS = 7;

// Ceiling on how many outliers detectCompetitorPriceAnomalies returns.
// Generous enough that the Market page's 10-per-page table has real depth
// to page through, small enough that a volatile week in a large market
// cannot turn one card into an unbounded list.
const MAX_PRICE_ANOMALIES = 50;

type PctChange = { productId: string; pctChange: number };

// Pure IQR-fence pass over a list of week-over-week % price changes -
// unchanged from the original implementation, just extracted so the
// confirmation gate can run it against more than one baseline, and so it's
// unit-testable without a database. Exported for tests only.
export function iqrOutlierIds(changes: PctChange[]): Set<string> {
  if (changes.length < MIN_DAYS_FOR_BASELINE) return new Set();

  const sortedChanges = [...changes.map((c) => c.pctChange)].sort((a, b) => a - b);
  const q1 = sortedChanges[Math.floor(sortedChanges.length * 0.25)];
  const q3 = sortedChanges[Math.floor(sortedChanges.length * 0.75)];
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  return new Set(changes.filter((c) => c.pctChange < lowerFence || c.pctChange > upperFence).map((c) => c.productId));
}

// Native-currency % change only (no FX conversion, no display fields) -
// this is the shared shape used to compute outlier status for both the
// current baseline and the prior (confirmation-cycle) baseline. The
// currency-converted, display-ready CompetitorPriceAnomaly list is built
// separately, only for the current baseline, once confirmation has already
// narrowed down which product ids to keep. Exported for tests only.
export function computePctChanges(
  products: { id: string; price: number | null }[],
  oldestPriceByProduct: Map<string, number>,
): PctChange[] {
  const result: PctChange[] = [];
  for (const product of products) {
    const rawOldPrice = oldestPriceByProduct.get(product.id);
    if (rawOldPrice == null || Math.abs(rawOldPrice) < MIN_BASELINE_PRICE || product.price == null) continue;
    result.push({ productId: product.id, pctChange: ((Number(product.price) - rawOldPrice) / rawOldPrice) * 100 });
  }
  return result;
}

// IQR outlier detection on week-over-week % price changes across every
// product in the category - flags moves that are unusual relative to how
// volatile this specific category actually is, rather than a fixed
// percentage threshold (which would over-flag in a volatile category like
// electronics during a sale event, and under-flag in a stable one).
//
// Gated by ANOMALY_CONFIRMATION_CYCLES: a product must be an outlier
// against both the current (PRICE_HISTORY_LOOKBACK_DAYS-old) baseline and
// a second, one-day-older baseline before it surfaces. Unlike the revenue
// detector, there's no per-day history of "current price as of yesterday"
// available here without a heavier query (market_products.price is always
// "now") - so this only re-validates against a shifted baseline reference
// point, not a second independent reading of the current price. That still
// catches the most common glitch class (a bad/stale baseline row skewing
// the % change) but won't catch a bad *current* scrape on its own.
export async function detectCompetitorPriceAnomalies(
  categorySlug: string,
  reportingCurrency = 'PKR',
  // Every outlier in the window used to come back, uncapped, and the whole
  // list was serialised into the page payload and rendered as one table.
  // The result is already sorted by |pctChange|, so the tail is the least
  // anomalous end of it - nobody acts on the 400th biggest price move.
  // A cap here, not just pagination in the UI, because the rows the seller
  // will never page to still cost a query, a transfer and a render.
  limit = MAX_PRICE_ANOMALIES,
): Promise<CompetitorPriceAnomaly[]> {
  const scope = await getMarketScope(categorySlug);
  if (scope.categorySlugs.length === 0) return [];

  const supabase = await createClient();
  const cutoff = new Date(Date.now() - PRICE_HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const priorCutoff = new Date(Date.now() - (PRICE_HISTORY_LOOKBACK_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();

  const fxRates = await getLatestFxRates();

  const { data: products, error: productsError } = await supabase
    .from('market_products')
    .select('id, title, category_slug, price, currency, image_url, market_platforms(name)')
    .eq('is_active', true)
    .not('price', 'is', null)
    .in('category_slug', scope.categorySlugs)
    .in('platform_id', scope.activePlatformIds);

  if (productsError || !products) return [];

  // The scope filter now lives in the query above (`.in('category_slug', …)`),
  // so every returned row is already inside the seller's market definition.
  const matched = products;
  if (matched.length === 0) return [];

  // market_scope_price_baseline() (migration 043) replaces what used to be
  // an unbounded `.in('product_id', …)` over market_price_history with no
  // limit - the exact pattern getPriceTrend()'s own comment (above, in
  // market-insights.ts) describes as already fixed for that function, but
  // never was here. Returns one row per product: its most recent
  // observation at or before the cutoff, via an indexed `distinct on` scan
  // instead of pulling every history row in the window into JS. Called
  // twice - once at the normal cutoff, once one day further back - purely
  // to build the confirmation-cycle baseline described above.
  const [{ data: history, error: historyError }, { data: priorHistory, error: priorHistoryError }] = await Promise.all([
    supabase.rpc('market_scope_price_baseline', {
      p_category_slugs: scope.categorySlugs,
      p_platform_ids: scope.activePlatformIds,
      p_cutoff: cutoff,
    }),
    supabase.rpc('market_scope_price_baseline', {
      p_category_slugs: scope.categorySlugs,
      p_platform_ids: scope.activePlatformIds,
      p_cutoff: priorCutoff,
    }),
  ]);

  if (historyError || !history || priorHistoryError || !priorHistory) return [];

  const oldestPriceByProduct = new Map<string, number>();
  for (const row of history as { product_id: string; baseline_price: number | string }[]) {
    oldestPriceByProduct.set(row.product_id, Number(row.baseline_price));
  }
  const priorOldestPriceByProduct = new Map<string, number>();
  for (const row of priorHistory as { product_id: string; baseline_price: number | string }[]) {
    priorOldestPriceByProduct.set(row.product_id, Number(row.baseline_price));
  }

  const currentOutlierIds = iqrOutlierIds(computePctChanges(matched, oldestPriceByProduct));
  const priorOutlierIds = iqrOutlierIds(computePctChanges(matched, priorOldestPriceByProduct));

  const changes: { product: (typeof matched)[number]; oldPrice: number; newPrice: number; pctChange: number }[] = [];
  for (const product of matched) {
    if (!currentOutlierIds.has(product.id) || !priorOutlierIds.has(product.id)) continue;
    const rawOldPrice = oldestPriceByProduct.get(product.id);
    if (rawOldPrice == null || product.price == null) continue;
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

  return changes
    .map((c) => {
      const platform = Array.isArray(c.product.market_platforms) ? c.product.market_platforms[0] : c.product.market_platforms;
      return {
        productId: c.product.id,
        title: c.product.title,
        platformName: platform?.name ?? null,
        imageUrl: c.product.image_url ?? null,
        oldPrice: c.oldPrice,
        newPrice: c.newPrice,
        pctChange: Number(c.pctChange.toFixed(1)),
      };
    })
    .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))
    .slice(0, limit);
}
