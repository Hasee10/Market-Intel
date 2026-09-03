import { detectCompetitorPriceAnomalies } from '@/lib/market-intel/anomalies';
import { getDomainBenchmarks, getDomainPeers } from '@/lib/market-intel/benchmarks';
import { getCategoryPricing } from '@/lib/market-intel/category-pricing';
import { getMarketScopeSummary } from '@/lib/market-intel/market-definition';
import { hasFeature } from '@/lib/market-intel/entitlements';
import { getCategoryPriceForecast } from '@/lib/market-intel/forecast';
import {
  getDataFreshness,
  getDemandSignal,
  getPriceTrend,
  getStockOuts,
} from '@/lib/market-intel/market-insights';
import { getPricingRecommendations } from '@/lib/market-intel/pricing-recommendation';
import { findTopProductMatches } from '@/lib/market-intel/product-matching';
import { getCurrentSeller, getPrimaryDomain, listSellerDomains, type SellerDomain } from '@/lib/market-intel/seller';

import MarketView from './MarketView';

// Server Component: fetches server-side, hands plain data off to the
// client MarketView for rendering - keeps data-fetching and rendering
// split the same way the rest of this app's pages do (fetch in the page,
// render in a 'use client' component).
export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain: domainSlug } = await searchParams;
  const seller = await getCurrentSeller();
  const primaryDomain = seller ? await getPrimaryDomain(seller.id) : null;

  // ?domain=<slug> comes from the header's DomainSwitcher (phase 1: only
  // Overview reads it). Resolved against this seller's own tracked domains
  // - not a raw lookup by slug - so a seller can never land on another
  // seller's category by editing the URL. Falls back to primary when the
  // param is absent, or points at a domain the seller no longer tracks
  // (stale bookmark).
  let domain: SellerDomain | null = primaryDomain;
  if (domainSlug && seller && domainSlug !== primaryDomain?.categorySlug) {
    const domains = await listSellerDomains(seller.id);
    const matched = domains.find((d) => d.categorySlug === domainSlug);
    if (matched) {
      domain = {
        categoryId: matched.categoryId,
        categorySlug: matched.categorySlug,
        categoryName: matched.categoryName,
      };
    }
  }

  const planTier = seller?.planTier ?? 'free';

  const entitlements = {
    peerBenchmarks: hasFeature(planTier, 'peer_benchmarks'),
    productMatching: hasFeature(planTier, 'product_matching'),
    pricingRecommendations: hasFeature(planTier, 'pricing_recommendations'),
    forecasting: hasFeature(planTier, 'forecasting'),
    anomalyDetection: hasFeature(planTier, 'anomaly_detection'),
  };

  const reportingCurrency = seller?.reportingCurrency ?? 'PKR';

  // Every fetch below depends only on `seller`/`domain`/`reportingCurrency`,
  // all of which are resolved above - none of them consume each other's
  // results. Awaiting them on twelve consecutive lines made the page's
  // time-to-first-byte the *sum* of twelve round-trips; running them
  // concurrently makes it the slowest single one. Same data, same order on
  // the page, one Promise.all.
  const [
    benchmarks,
    peers,
    // ROADMAP.md C2: the scope every figure below is computed against, echoed
    // back at the top of the page instead of being implicit.
    scopeSummary,
    categoryPricing,
    priceTrend,
    stockOuts,
    freshness,
    demandSignal,
    productMatches,
    pricingRecommendations,
    priceForecast,
    priceAnomalies,
  ] = await Promise.all([
    domain && entitlements.peerBenchmarks ? getDomainBenchmarks(domain.categoryId) : [],
    domain && seller && entitlements.peerBenchmarks ? getDomainPeers(domain.categoryId, seller.id) : [],
    domain && seller ? getMarketScopeSummary(domain.categorySlug, domain.categoryName, seller.id) : null,
    domain ? getCategoryPricing(domain.categorySlug, reportingCurrency) : null,
    domain ? getPriceTrend(domain.categorySlug, reportingCurrency) : [],
    domain ? getStockOuts(domain.categorySlug, 10, reportingCurrency) : [],
    domain ? getDataFreshness(domain.categorySlug) : [],
    domain ? getDemandSignal(domain.categorySlug) : null,
    domain && seller && entitlements.productMatching
      ? findTopProductMatches(seller.id, domain.categorySlug, reportingCurrency)
      : [],
    domain && seller && entitlements.pricingRecommendations
      ? getPricingRecommendations(seller.id, domain.categorySlug, reportingCurrency)
      : [],
    domain && entitlements.forecasting ? getCategoryPriceForecast(domain.categorySlug, reportingCurrency) : null,
    domain && entitlements.anomalyDetection
      ? detectCompetitorPriceAnomalies(domain.categorySlug, reportingCurrency)
      : [],
  ]);

  return (
    <MarketView
      domain={domain}
      scopeSummary={scopeSummary}
      reportingCurrency={reportingCurrency}
      benchmarks={benchmarks}
      peers={peers}
      categoryPricing={categoryPricing}
      priceTrend={priceTrend}
      stockOuts={stockOuts}
      freshness={freshness}
      demandSignal={demandSignal}
      productMatches={productMatches}
      pricingRecommendations={pricingRecommendations}
      priceForecast={priceForecast}
      priceAnomalies={priceAnomalies}
      entitlements={entitlements}
    />
  );
}
