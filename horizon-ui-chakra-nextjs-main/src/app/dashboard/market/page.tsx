import { detectCompetitorPriceAnomalies } from '@/lib/market-intel/anomalies';
import { getDomainBenchmarks, getDomainPeers } from '@/lib/market-intel/benchmarks';
import { getCategoryPricing } from '@/lib/market-intel/category-pricing';
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
import { getCurrentSeller, getPrimaryDomain } from '@/lib/market-intel/seller';

import MarketView from './MarketView';

// Server Component: fetches server-side, hands plain data off to the
// client MarketView for rendering - keeps data-fetching and rendering
// split the same way the rest of this app's pages do (fetch in the page,
// render in a 'use client' component).
export default async function MarketPage() {
  const seller = await getCurrentSeller();
  const domain = seller ? await getPrimaryDomain(seller.id) : null;
  const planTier = seller?.planTier ?? 'free';

  const entitlements = {
    peerBenchmarks: hasFeature(planTier, 'peer_benchmarks'),
    productMatching: hasFeature(planTier, 'product_matching'),
    pricingRecommendations: hasFeature(planTier, 'pricing_recommendations'),
    forecasting: hasFeature(planTier, 'forecasting'),
    anomalyDetection: hasFeature(planTier, 'anomaly_detection'),
  };

  const reportingCurrency = seller?.reportingCurrency ?? 'PKR';

  const benchmarks = domain && entitlements.peerBenchmarks ? await getDomainBenchmarks(domain.categoryId) : [];
  const peers = domain && seller && entitlements.peerBenchmarks ? await getDomainPeers(domain.categoryId, seller.id) : [];
  const categoryPricing = domain ? await getCategoryPricing(domain.categorySlug, reportingCurrency) : null;
  const priceTrend = domain ? await getPriceTrend(domain.categorySlug, reportingCurrency) : [];
  const stockOuts = domain ? await getStockOuts(domain.categorySlug, 10, reportingCurrency) : [];
  const freshness = domain ? await getDataFreshness(domain.categorySlug) : [];
  const demandSignal = domain ? await getDemandSignal(domain.categorySlug) : null;
  const productMatches =
    domain && seller && entitlements.productMatching
      ? await findTopProductMatches(seller.id, domain.categorySlug, reportingCurrency)
      : [];
  const pricingRecommendations =
    domain && seller && entitlements.pricingRecommendations
      ? await getPricingRecommendations(seller.id, domain.categorySlug, reportingCurrency)
      : [];
  const priceForecast =
    domain && entitlements.forecasting ? await getCategoryPriceForecast(domain.categorySlug, reportingCurrency) : null;
  const priceAnomalies =
    domain && entitlements.anomalyDetection
      ? await detectCompetitorPriceAnomalies(domain.categorySlug, reportingCurrency)
      : [];

  return (
    <MarketView
      domain={domain}
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
