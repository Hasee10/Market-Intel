import { getDomainBenchmarks, getDomainPeers } from '@/lib/market-intel/benchmarks';
import { getCategoryPricing } from '@/lib/market-intel/category-pricing';
import {
  getDataFreshness,
  getDemandSignal,
  getPriceTrend,
  getStockOuts,
} from '@/lib/market-intel/market-insights';
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

  const benchmarks = domain ? await getDomainBenchmarks(domain.categoryId) : [];
  const peers = domain && seller ? await getDomainPeers(domain.categoryId, seller.id) : [];
  const categoryPricing = domain ? await getCategoryPricing(domain.categorySlug) : null;
  const priceTrend = domain ? await getPriceTrend(domain.categorySlug) : [];
  const stockOuts = domain ? await getStockOuts(domain.categorySlug) : [];
  const freshness = domain ? await getDataFreshness(domain.categorySlug) : [];
  const demandSignal = domain ? await getDemandSignal(domain.categorySlug) : null;
  const productMatches = domain && seller ? await findTopProductMatches(seller.id, domain.categorySlug) : [];

  return (
    <MarketView
      domain={domain}
      benchmarks={benchmarks}
      peers={peers}
      categoryPricing={categoryPricing}
      priceTrend={priceTrend}
      stockOuts={stockOuts}
      freshness={freshness}
      demandSignal={demandSignal}
      productMatches={productMatches}
    />
  );
}
