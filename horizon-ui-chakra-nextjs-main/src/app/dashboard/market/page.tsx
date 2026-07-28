import { getDomainBenchmarks, getDomainPeers } from '@/lib/market-intel/benchmarks';
import { getCategoryPricing } from '@/lib/market-intel/category-pricing';
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

  return (
    <MarketView
      domain={domain}
      benchmarks={benchmarks}
      peers={peers}
      categoryPricing={categoryPricing}
    />
  );
}
