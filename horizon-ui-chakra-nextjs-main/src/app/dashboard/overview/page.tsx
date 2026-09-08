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
import type { OrderAnomaly } from '@/lib/market-intel/market/anomalies';
import type { RevenueForecast } from '@/lib/market-intel/market/forecast';

import {
  getOnboardingStatus,
  type OnboardingStatus,
} from '@/lib/market-intel/seller/onboarding-status';

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
// One request, one getCurrentSeller() call, one round of parallel fetches.
// The five ecommerce/* route handlers stay in place and now call these same
// functions - see lib/market-intel/seller/overview.ts's header comment for
// how their error contract is preserved too, not just their success shape.
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

  // allSettled, not all: the client version fetched each of these as an
  // independent request, so one failing never took the others down with it
  // - the failed section just rendered empty (useFetch's data stayed
  // undefined, and every consumer below already does `?? []`/`?? null`).
  // A plain Promise.all here would lose that: one rejected call would throw
  // the whole Server Component, and there is no error.tsx anywhere in this
  // app to catch it - the visitor would get Next's generic crash page
  // instead of four working sections and one empty one. allSettled keeps
  // the original fault isolation.
  const [statsR, productsR, ordersR, categoriesR, revenueTrendR] = await Promise.allSettled([
    getEcommerceStats(seller.id, seller.reportingCurrency),
    getTopProductsByInventoryValue(seller.id, seller.reportingCurrency),
    getOrderStatusBreakdown(seller.id),
    getCategoryInventoryValue(seller.id),
    getRevenueTrend(seller.id, seller.reportingCurrency),
  ]);

  // Mirrors the original client-side authFailed check exactly: it only
  // showed the full-page error when ALL FIVE core requests came back
  // failed, using the first one's message. One or a few failing (a single
  // flaky query, not an outage) was never treated as fatal - those sections
  // simply rendered empty, which is what the per-result fallback below
  // still does for a partial failure.
  const settled = [statsR, productsR, ordersR, categoriesR, revenueTrendR];
  if (settled.every((r) => r.status === 'rejected')) {
    const first = statsR as PromiseRejectedResult;
    const message = first.reason instanceof Error ? first.reason.message : 'Not authenticated';
    return <ErrorAlert title="Error loading dashboard" message={message || 'Not authenticated'} />;
  }

  const stats = statsR.status === 'fulfilled' ? statsR.value : [];
  const products = productsR.status === 'fulfilled' ? productsR.value : [];
  const orders = ordersR.status === 'fulfilled' ? ordersR.value : [];
  const categories = categoriesR.status === 'fulfilled' ? categoriesR.value : [];
  const revenueTrend = revenueTrendR.status === 'fulfilled' ? revenueTrendR.value : [];

  // These two never participated in the original authFailed check at all -
  // their routes had no try/catch, so a failure there was already silently
  // invisible to the page (the client's useFetch caught it into an `error`
  // state the page never read). .catch() here reproduces that exact
  // silence, and keeps a throw in either from reaching the Promise above.
  //
  // onboardingStatus joins them here for the same reason: OnboardingChecklist
  // was fetching /api/onboarding-status for itself on mount, which was one
  // more client round trip on the page whose waterfall this file exists to
  // remove. Same .catch() treatment - a checklist is an aid, and failing to
  // load one should not disturb the dashboard around it.
  const [anomalies, forecast, onboardingStatus] = await Promise.all([
    canSeeAnomalies
      ? detectOwnRevenueAnomalies(seller.id, seller.reportingCurrency).catch((): OrderAnomaly[] => [])
      : Promise.resolve<OrderAnomaly[]>([]),
    canSeeForecast
      ? getRevenueForecast(seller.id, seller.reportingCurrency).catch((): RevenueForecast | null => null)
      : Promise.resolve<RevenueForecast | null>(null),
    getOnboardingStatus(seller.id).catch((): OnboardingStatus | null => null),
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
      onboardingStatus={onboardingStatus}
    />
  );
}
