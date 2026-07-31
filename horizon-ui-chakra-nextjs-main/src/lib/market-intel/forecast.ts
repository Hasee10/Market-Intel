'server-only';

import { createClient } from '@/lib/supabase/server';
import { getPriceTrend } from '@/lib/market-intel/market-insights';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';

// Ordinary least squares on (dayIndex, value) - a straight-line trend, not
// ARIMA/exponential smoothing/LSTM. With a scraper that runs every 2 days and
// order histories measured in weeks, there isn't enough history for a
// seasonal or higher-order model to fit anything but noise; a transparent
// linear trend is the honest answer at this data volume (see
// new_implementation_doc.md Phase 4).
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export type ForecastPoint = { date: string; value: number; isProjected: boolean };

export type PriceForecast = {
  points: ForecastPoint[];
  trendDirection: 'up' | 'down' | 'flat';
  changePerWeek: number;
};

const MIN_POINTS_FOR_FORECAST = 5;
const FORECAST_HORIZON_DAYS = 14;

// Extends the existing 30-day price-trend series (market-insights.ts) with
// a linear projection forward. Returns null rather than a forecast built
// from too little data - a trend line through 2-3 points is misleading, not
// useful.
export async function getCategoryPriceForecast(categorySlug: string, reportingCurrency = 'PKR'): Promise<PriceForecast | null> {
  const trend = await getPriceTrend(categorySlug, reportingCurrency);
  if (trend.length < MIN_POINTS_FOR_FORECAST) return null;

  const baseDate = new Date(trend[0].date);
  const points = trend.map((p) => ({
    x: (new Date(p.date).getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000),
    y: p.medianPrice,
  }));

  const { slope, intercept } = linearRegression(points);
  const lastX = points[points.length - 1].x;

  const historical: ForecastPoint[] = trend.map((p) => ({ date: p.date, value: p.medianPrice, isProjected: false }));
  const projected: ForecastPoint[] = [];
  for (let i = 1; i <= FORECAST_HORIZON_DAYS; i += 1) {
    const x = lastX + i;
    const date = new Date(baseDate.getTime() + x * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    projected.push({ date, value: Math.max(0, slope * x + intercept), isProjected: true });
  }

  const changePerWeek = slope * 7;
  const trendDirection = Math.abs(changePerWeek) < 1 ? 'flat' : changePerWeek > 0 ? 'up' : 'down';

  return { points: [...historical, ...projected], trendDirection, changePerWeek: Math.round(changePerWeek * 100) / 100 };
}

export type RevenueForecast = {
  points: ForecastPoint[];
  trendDirection: 'up' | 'down' | 'flat';
  changePerWeek: number;
};

const REVENUE_LOOKBACK_DAYS = 60;

// Same technique applied to the seller's own daily revenue, not competitor
// pricing - a distinct signal (are they growing or shrinking), reusing the
// same honest-about-its-limits linear-trend approach.
export async function getRevenueForecast(sellerId: string, reportingCurrency: string): Promise<RevenueForecast | null> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - REVENUE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ data, error }, fxRates] = await Promise.all([
    supabase
      .from('seller_orders')
      .select('order_date, total_amount, currency')
      .eq('seller_id', sellerId)
      .gte('order_date', cutoff),
    getLatestFxRates(),
  ]);

  if (error || !data) return null;

  const byDate = new Map<string, number>();
  for (const row of data) {
    const date = row.order_date.slice(0, 10);
    const amount = convertCurrency(Number(row.total_amount), row.currency, reportingCurrency, fxRates);
    byDate.set(date, (byDate.get(date) ?? 0) + amount);
  }

  const series = Array.from(byDate.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (series.length < MIN_POINTS_FOR_FORECAST) return null;

  const baseDate = new Date(series[0].date);
  const points = series.map((p) => ({
    x: (new Date(p.date).getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000),
    y: p.revenue,
  }));

  const { slope, intercept } = linearRegression(points);
  const lastX = points[points.length - 1].x;

  const historical: ForecastPoint[] = series.map((p) => ({ date: p.date, value: p.revenue, isProjected: false }));
  const projected: ForecastPoint[] = [];
  for (let i = 1; i <= FORECAST_HORIZON_DAYS; i += 1) {
    const x = lastX + i;
    const date = new Date(baseDate.getTime() + x * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    projected.push({ date, value: Math.max(0, slope * x + intercept), isProjected: true });
  }

  const changePerWeek = slope * 7;
  const trendDirection = Math.abs(changePerWeek) < 1 ? 'flat' : changePerWeek > 0 ? 'up' : 'down';

  return { points: [...historical, ...projected], trendDirection, changePerWeek: Math.round(changePerWeek * 100) / 100 };
}
