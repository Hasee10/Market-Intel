import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { getSellerProducts } from '@/lib/market-intel/seller/products';
import { getDemandIndexes, type DemandIndex } from '@/lib/market-intel/market/demand-index';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';

import ProductsView from './ProductsView';

// Server Component: fetches the catalogue (and, when filtered, the clicked
// category's display name) in one pass, then hands plain data to the client
// ProductsView for rendering - the same split used on Overview and Market.
//
// This page used to be 'use client' with TWO separate client fetches -
// useFetch('/api/products') for the catalogue and a second,
// useFetch('/api/profile'), just to read the seller's country and reporting
// currency for the import-field config. Each paid its own auth round trip
// (see lib/market-intel/seller/overview.ts's header comment for why that's
// real, not theoretical). The second one is gone entirely here, not just
// moved server-side: country and reportingCurrency are already on the same
// getCurrentSeller() this page calls for the catalogue query, so there is
// nothing left to fetch a second time for.
//
// ?categoryId=&categoryName= used to force this into a client Suspense
// boundary (useSearchParams only works in a client component during
// prerendering). As a Server Component prop instead, searchParams needs no
// Suspense wrapper at all - one fewer moving part, not just a faster one.
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; categoryName?: string }>;
}) {
  const { categoryId, categoryName } = await searchParams;
  const categoryFilterId = categoryId ?? null;

  const seller = await getCurrentSeller();
  if (!seller) {
    return <ErrorAlert title="Error loading products" message="Not authenticated" />;
  }

  try {
    // Demand index alongside the list, failing soft: it depends on a
    // confirmed match per product and on migration 061 being applied, and
    // neither should be able to stop the catalogue from rendering.
    const [rawProducts, demand] = await Promise.all([
      getSellerProducts(seller.id, categoryFilterId),
      getDemandIndexes(seller.id).catch((): Map<string, DemandIndex> => new Map()),
    ]);
    const products = rawProducts.map((p) => ({ ...p, demandIndex: demand.get(p.id) ?? null }));

    // categoryName arrives as a query param from the Categories page's own
    // click-through, which already knows the name at click time - it is
    // display text, not something this page looks up. Passed straight
    // through, same as the original client version did with
    // searchParams.get('categoryName').
    return (
      <ProductsView
        products={products}
        categoryFilterName={categoryName ?? null}
        sellerCountry={seller.country}
        sellerReportingCurrency={seller.reportingCurrency}
      />
    );
  } catch (err) {
    return (
      <ErrorAlert
        title="Error loading products"
        message={err instanceof Error ? err.message : 'Failed to fetch products'}
      />
    );
  }
}
