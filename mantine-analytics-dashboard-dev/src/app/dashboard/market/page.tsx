import { getDomainBenchmarks, getDomainPeers } from '@/lib/market-intel/benchmarks';
import { getCategoryPricing } from '@/lib/market-intel/category-pricing';
import { getCurrentSeller, getPrimaryDomain } from '@/lib/market-intel/seller';

import MarketView from './MarketView';

// This is the only Server Component under /dashboard - every other page here
// is 'use client' and fetches via /api routes. Mantine v7's components need
// a client boundary to render correctly under Next 16 + Turbopack; rendering
// them directly from an async Server Component throws "Element type is
// invalid" at render time. Keep this file to data-fetching only and hand the
// plain data off to MarketView (client) for rendering.
async function Page() {
  const seller = await getCurrentSeller();
  const domain = seller ? await getPrimaryDomain(seller.id) : null;

  const benchmarks = domain ? await getDomainBenchmarks(domain.categoryId) : [];
  const peers = domain && seller ? await getDomainPeers(domain.categoryId, seller.id) : [];
  const categoryPricing = domain ? await getCategoryPricing(domain.categorySlug) : null;

  return (
    <>
      <title>Market | Market Intel</title>
      <meta
        name="description"
        content="See how you compare to other sellers in your domain using only non-sensitive, opt-in benchmark data."
      />
      <MarketView
        domain={domain}
        benchmarks={benchmarks}
        peers={peers}
        categoryPricing={categoryPricing}
      />
    </>
  );
}

export default Page;
