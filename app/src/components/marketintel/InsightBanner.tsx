'use client';

import {
  MdOutlineTrendingUp,
  MdOutlineTrendingDown,
  MdOutlineInventory2,
  MdOutlineCheckCircle,
} from 'react-icons/md';

import { PATH_APPS } from '@/lib/paths';
import type { StatItem } from '@/components/marketintel/StatsGrid';
import type { OrderAnomaly } from '@/lib/market-intel/market/anomalies';
import type { RevenueForecast } from '@/lib/market-intel/market/forecast';
import { InsightStrip, type Insight } from '@/components/marketintel/InsightStrip';

// Overview's own instant-insight rule + the component that renders it.
// InsightStrip.tsx holds the visual chrome (tone colours, icon chip,
// layout) shared with Market's and Watchlist's own insight strips - this
// file is only Overview's specific priority order over its own data.
//
// Rule-based on purpose, same posture as pricing-recommendation.ts: a
// seller acts on this, so it has to be traceable to a real number, not an
// LLM guess. Priority order (most urgent/actionable first):
//   1. A revenue anomaly (spike or drop) - already computed server-side by
//      detectOwnRevenueAnomalies, a real statistical outlier, not noise.
//   2. Low stock - operational and time-sensitive; ignoring it costs sales.
//   3. A meaningful revenue swing vs last month (>=5%, and only when the
//      underlying diff wasn't null - see the near-zero-baseline guard in
//      app/api/ecommerce/stats/route.ts; a null diff means "not a real
//      comparison" and must never be spoken as if it were one).
//   4. A Premium-only revenue forecast trend, if the seller has it.
//   5. A calm fallback - "nothing unusual" is itself an answer, not an
//      empty space. Never leave this strip blank.

function formatMoney(v: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const REVENUE_SWING_THRESHOLD_PCT = 5;

export function computeTopInsight({
  stats,
  anomaly,
  forecast,
  currency,
}: {
  stats: StatItem[];
  anomaly: OrderAnomaly | undefined;
  forecast: RevenueForecast | null;
  currency: string;
}): Insight {
  if (anomaly) {
    const isDrop = anomaly.direction === 'drop';
    return {
      tone: isDrop ? 'critical' : 'good',
      icon: isDrop ? MdOutlineTrendingDown : MdOutlineTrendingUp,
      headline: `Revenue ${isDrop ? 'dropped sharply' : 'spiked'} on ${formatDate(anomaly.date)}`,
      detail: `${formatMoney(anomaly.revenue, currency)} that day, vs your usual ${formatMoney(anomaly.expectedRange[0], currency)}–${formatMoney(anomaly.expectedRange[1], currency)} range.`,
      ctaLabel: 'View orders',
      ctaHref: PATH_APPS.orders,
    };
  }

  const lowStock = stats.find((s) => s.title === 'Low Stock Products');
  // StatItem.value is a formatted display string (toLocaleString()), which
  // adds thousands separators above 999 - strip them before parsing, or a
  // low-stock count of 1,000+ would silently become NaN here.
  const lowStockCount = lowStock ? Number(lowStock.value.replace(/,/g, '')) : 0;
  if (lowStockCount > 0) {
    return {
      tone: 'warning',
      icon: MdOutlineInventory2,
      headline: `${lowStockCount} product${lowStockCount === 1 ? '' : 's'} running low on stock`,
      detail: 'Restock soon - a stock-out is a sale you can\'t get back.',
      ctaLabel: 'View products',
      ctaHref: PATH_APPS.products.root,
    };
  }

  const revenue = stats.find((s) => s.title === 'Revenue (30d)');
  if (revenue?.diff != null && Math.abs(revenue.diff) >= REVENUE_SWING_THRESHOLD_PCT) {
    const up = revenue.diff > 0;
    return {
      tone: up ? 'good' : 'warning',
      icon: up ? MdOutlineTrendingUp : MdOutlineTrendingDown,
      headline: `Revenue is ${up ? 'up' : 'down'} ${Math.abs(revenue.diff)}% vs last month`,
      detail: up ? 'Whatever you changed, it\'s working.' : 'Worth checking what changed this period.',
    };
  }

  if (forecast && forecast.trendDirection !== 'flat') {
    const up = forecast.trendDirection === 'up';
    return {
      tone: up ? 'good' : 'warning',
      icon: up ? MdOutlineTrendingUp : MdOutlineTrendingDown,
      headline: `Revenue is projected to keep ${up ? 'climbing' : 'declining'}`,
      detail: 'Based on the trend in your last 60 days of orders.',
    };
  }

  return {
    tone: 'neutral',
    icon: MdOutlineCheckCircle,
    headline: 'Nothing unusual to flag right now',
    detail: 'Revenue, stock, and orders are all tracking normally.',
  };
}

export function InsightBanner(props: {
  stats: StatItem[];
  anomaly: OrderAnomaly | undefined;
  forecast: RevenueForecast | null;
  currency: string;
}) {
  return <InsightStrip insight={computeTopInsight(props)} />;
}

export default InsightBanner;
