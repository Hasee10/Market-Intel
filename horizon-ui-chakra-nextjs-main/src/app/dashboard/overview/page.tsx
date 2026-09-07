import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { hasFeature } from '@/lib/market-intel/core/entitlements';
import { detectOwnRevenueAnomalies } from '@/lib/market-intel/market/anomalies';
import { getRevenueForecast } from '@/lib/market-intel/market/forecast';
import {
  getCategoryInventoryValue,
  getEcommerceStats,
  getOrderStatusBreakdown,
  getRevenueTrend,
  getTopProductsByInventoryValue,
} from '@/lib/market-intel/seller/overview';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';

import OverviewView from './OverviewView';

// Server Component: fetches everything Overview needs in one request, then
// hands plain data to the client OverviewView for rendering - the same
// split Market and Watchlist already use (see MarketView.tsx).
//
// This page used to be the odd one out: 'use client' from the top, with
// seven separate useFetch() calls firing after hydration. Each of those was
// its own HTTP request to its own route handler, and every route handler
// called getCurrentSeller() - cache()'d per request, but each of those
// requests was separate, so cache() bought nothing across them. Seven
// requests meant seven real network round trips to Supabase's auth service
// (getCurrentSeller's own comment: "not a local JWT decode") before the
// page was fully painted, stacked on top of the client having to download
// and hydrate before any of them could even start.
//
// One request, one getCurrentSeller() call, one Promise.all. The five
// ecommerce/* route handlers stay in place and now call these same
// functions, so nothing that hits them directly changes behaviour - see
// lib/market-intel/seller/overview.ts's header comment.
export default async function OverviewPage() {
  const seller = await getCurrentSeller();

  // Middleware already keeps signed-out visitors off /dashboard/*, so this
  // is a defensive fallback (its own comment calls it "a redirect-UX gate,
  // not a security boundary") rather than the primary guard - same posture
  // Market's page.tsx takes with a null seller, not a new convention.
  if (!seller) {
    return <ErrorAlert title="Error loading dashboard" message="Not authenticated" />;
  }

  const canSeeAnomalies = hasFeature(seller.planTier, 'anomaly_detection');
  const canSeeForecast = hasFeature(seller.planTier, 'forecasting');

  const [stats, products, orders, categories, revenueTrend, anomalies, forecast] = await Promise.all([
    getEcommerceStats(seller.id, seller.reportingCurrency),
    getTopProductsByInventoryValue(seller.id, seller.reportingCurrency),
    getOrderStatusBreakdown(seller.id),
    getCategoryInventoryValue(seller.id),
    getRevenueTrend(seller.id, seller.reportingCurrency),
    canSeeAnomalies ? detectOwnRevenueAnomalies(seller.id, seller.reportingCurrency) : Promise.resolve([]),
    canSeeForecast ? getRevenueForecast(seller.id, seller.reportingCurrency) : Promise.resolve(null),
  ]);

  return (
    <OverviewView
      stats={stats}
      products={products}
      orders={orders}
      categories={categories}
      revenueTrend={revenueTrend}
      anomalies={anomalies}
      forecast={forecast}
      reportingCurrency={seller.reportingCurrency}
    />
  );
}
