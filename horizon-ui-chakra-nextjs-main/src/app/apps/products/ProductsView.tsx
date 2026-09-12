'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  MdAddCircleOutline,
  MdGridView,
  MdOutlineSearchOff,
  MdUploadFile,
  MdViewList,
  MdOutlineInventory2,
  MdOutlinePriceCheck,
  MdOutlineCheckCircle,
} from 'react-icons/md';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { Reveal } from 'components/reactbits/Reveal';

import { BulkImportDrawer, ImportField } from '@/components/marketintel/BulkImportDrawer';
import { InsightStrip, type Insight } from '@/components/marketintel/InsightStrip';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { ProductsTable } from '@/components/marketintel/ProductsTable';
import { getCountryProductConfig } from '@/lib/market-intel/core/countries';
import { PATH_DASHBOARD } from '@/lib/paths';
import { IProduct } from '@/types/products';

import { CompetitorsDrawer } from './components/CompetitorsDrawer';
import { EditProductDrawer } from './components/EditProductDrawer';
import { NewProductDrawer } from './components/NewProductDrawer';
import { ProductCard } from './components/ProductCard';

// Pure rendering - products and the seller's country/currency arrive as
// props, fetched server-side by page.tsx. This used to fetch products via
// useFetch('/api/products') and the seller's profile via a SEPARATE
// useFetch('/api/profile') just to read two fields (country, currency) -
// two client round trips, each paying its own auth cost, to render one
// page. Country/currency now come straight off the same getCurrentSeller()
// call page.tsx already makes; there is no second request to eliminate a
// waterfall from, because there is no second request at all.
//
// refetchProducts() is gone. A Server Component has no refetch of its own -
// the equivalent is router.refresh(), which re-runs page.tsx on the current
// route and hands this component fresh props. Every place that used to call
// refetchProducts() (create, edit, bulk import) calls router.refresh()
// instead, which is the documented Next.js idiom for "reload server data
// after a client mutation," not a workaround.
type ViewMode = 'grid' | 'table';

const breadcrumbItems = [
  { title: 'Dashboard', href: PATH_DASHBOARD.default },
  { title: 'Products', href: '#' },
];

type ProductsViewProps = {
  products: IProduct[];
  /** Display only - the actual filtering already happened server-side in
   * page.tsx before `products` ever reached this component. */
  categoryFilterName: string | null;
  sellerCountry: string | undefined;
  sellerReportingCurrency: string;
};

// SKU's `required` flag is the seller's own country config, not a fixed
// choice - a market without formal SKU conventions shouldn't be blocked
// from importing at all just because that one column isn't in their file.
// See countries.ts.
function buildImportFields(skuRequired: boolean, reportingCurrency: string): ImportField[] {
  return [
    {
      key: 'sku',
      label: 'SKU',
      required: skuRequired,
      helperText: skuRequired
        ? undefined
        : 'Optional for your region - rows without one are matched by product name on re-import.',
    },
    { key: 'title', label: 'Title', required: true },
    {
      key: 'currency',
      label: 'Currency',
      helperText: `Defaults to your reporting currency (${reportingCurrency}) when not mapped.`,
    },
    { key: 'costPrice', label: 'Cost price', type: 'number' },
    { key: 'sellPrice', label: 'Sell price', type: 'number' },
    { key: 'stockQty', label: 'Stock quantity', type: 'number' },
    { key: 'isActive', label: 'Active (yes/no)', type: 'boolean' },
    {
      key: 'imageUrl',
      label: 'Image URL',
      helperText:
        'Optional. Most store platforms export one - rows without it fall back to the category icon.',
    },
  ];
}

// Same instant-insight pattern used across the app (InsightStrip.tsx).
// Priority: low stock (operational, time-sensitive - same <10-units floor
// Overview's own low-stock stat uses) > missing a cost price (a data-
// completeness gap that quietly disables pricing recommendations for that
// product, not obvious from the table alone) > calm fallback stating the
// real active count. Scoped to active products only - an inactive
// product's stock/pricing isn't something to act on right now.
function computeProductsInsight(products: IProduct[]): Insight {
  const active = products.filter((p) => p.isActive);

  const lowStock = active.filter((p) => p.stockQty != null && p.stockQty < 10);
  if (lowStock.length > 0) {
    return {
      tone: 'warning',
      icon: MdOutlineInventory2,
      headline: `${lowStock.length} product${lowStock.length === 1 ? '' : 's'} running low on stock`,
      detail: 'Under 10 units - restock soon or a sale could go to a competitor.',
    };
  }

  const missingCost = active.filter((p) => p.costPrice == null && p.sellPrice != null);
  if (missingCost.length > 0) {
    return {
      tone: 'neutral',
      icon: MdOutlinePriceCheck,
      headline: `${missingCost.length} product${missingCost.length === 1 ? '' : 's'} missing a cost price`,
      detail: "Pricing recommendations can't run for these until you set one.",
    };
  }

  return {
    tone: 'good',
    icon: MdOutlineCheckCircle,
    headline: `${active.length} active product${active.length === 1 ? '' : 's'}, all priced and stocked`,
    detail: 'Nothing needs attention right now.',
  };
}

export default function ProductsView({
  products,
  categoryFilterName,
  sellerCountry,
  sellerReportingCurrency,
}: ProductsViewProps) {
  const router = useRouter();

  const [selectedProduct, setSelectedProduct] = useState<IProduct | null>(null);
  const [competitorsProduct, setCompetitorsProduct] = useState<IProduct | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [competitorsOpen, setCompetitorsOpen] = useState(false);

  // Both views below render every product page.tsx fetched for this filter.
  // One page state shared by both views, so switching between them keeps
  // your place instead of jumping.
  const productPage = usePagination(products, 12);

  const importFields = useMemo(
    () => buildImportFields(getCountryProductConfig(sellerCountry).skuRequired, sellerReportingCurrency),
    [sellerCountry, sellerReportingCurrency],
  );

  const refreshProducts = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleEditProduct = (product: IProduct) => {
    setSelectedProduct(product);
    setEditOpen(true);
  };

  const handleViewCompetitors = (product: IProduct) => {
    setCompetitorsProduct(product);
    setCompetitorsOpen(true);
  };

  // The category chip's clear button used to be router.push('/apps/products')
  // driven by client-side useSearchParams. categoryFilterId now comes from
  // page.tsx's own searchParams prop, so clearing it is the same navigation,
  // just still a real Next Link/router action - nothing about "click to
  // leave the filter" changes.
  const clearCategoryFilter = () => router.push('/apps/products');

  const renderContent = () => {
    if (products.length === 0) {
      return (
        <Card>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <MdOutlineSearchOff className="size-7 text-gray-400" aria-hidden="true" />
            <p className="text-lg font-bold text-gray-900 dark:text-white">No products found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {categoryFilterName
                ? `Nothing in ${categoryFilterName} yet. Add one to get started.`
                : "You don't have any products yet. Create one to get started."}
            </p>
            <Button
              className="mt-2"
              leftIcon={<MdAddCircleOutline className="size-4" />}
              onClick={() => setNewOpen(true)}
            >
              New Product
            </Button>
          </div>
        </Card>
      );
    }

    // One Pagination, shared by both views so switching keeps your page
    // number - but it can't sit outside the switch as one shared element the
    // way Customers does it: the table view has a Card wrapper (with its own
    // horizontal padding) and the grid view does not (the cards themselves
    // are the grid items), so a control placed after both would inherit
    // neither's padding and visibly hug the bare page edge under the table -
    // "the pagination is at the very side" - instead of lining up with the
    // content above it. Rendered once, but nested wherever that view's own
    // content is nested.
    const pagination = (
      <Pagination
        page={productPage.page}
        pageCount={productPage.pageCount}
        onPageChange={productPage.setPage}
        rangeStart={productPage.rangeStart}
        rangeEnd={productPage.rangeEnd}
        total={productPage.total}
        label="products"
      />
    );

    return viewMode === 'grid' ? (
      <>
        <div className="@container grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4 md:gap-6">
          {productPage.visible.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i, 12) * 40} className="h-full">
              <ProductCard data={p} onEdit={handleEditProduct} onViewCompetitors={handleViewCompetitors} />
            </Reveal>
          ))}
        </div>
        {pagination}
      </>
    ) : (
      <Card>
        <ProductsTable
          data={productPage.visible}
          loading={false}
          onEdit={handleEditProduct}
          onViewCompetitors={handleViewCompetitors}
        />
        {pagination}
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="Products"
        breadcrumbItems={breadcrumbItems}
        actionButton={
          <div className="flex flex-wrap gap-2">
            {products.length > 0 && (
              // Segmented control, same as Customers - two loose buttons
              // differing only by fill read as unrelated actions.
              <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={viewMode === 'grid'}
                  onClick={() => setViewMode('grid')}
                  className={`flex size-8 items-center justify-center rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <MdGridView className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Table view"
                  aria-pressed={viewMode === 'table'}
                  onClick={() => setViewMode('table')}
                  className={`flex size-8 items-center justify-center rounded-md transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <MdViewList className="size-4" />
                </button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<MdUploadFile className="size-4" />}
              onClick={() => setImportOpen(true)}
            >
              Import CSV
            </Button>
            <Button
              size="sm"
              leftIcon={<MdAddCircleOutline className="size-4" />}
              onClick={() => setNewOpen(true)}
            >
              New Product
            </Button>
          </div>
        }
      />

      {products.length > 0 && <InsightStrip insight={computeProductsInsight(products)} />}

      {categoryFilterName && (
        <div className="mb-4 flex">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 py-1.5 pl-3.5 pr-2 text-sm font-medium text-brand-700 dark:bg-gray-800 dark:text-brand-400">
            Category: {categoryFilterName}
            <button
              type="button"
              onClick={clearCategoryFilter}
              aria-label={`Clear ${categoryFilterName} filter`}
              className="flex size-5 items-center justify-center rounded-full transition-colors hover:bg-brand-100 dark:hover:bg-gray-700"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-3">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </span>
        </div>
      )}

      {renderContent()}

      <NewProductDrawer isOpen={newOpen} onClose={() => setNewOpen(false)} onProductCreated={refreshProducts} />

      <EditProductDrawer
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        product={selectedProduct}
        onProductUpdated={refreshProducts}
      />

      <BulkImportDrawer
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="products"
        fields={importFields}
        apiEndpoint="/api/products/bulk-import"
        onImported={refreshProducts}
      />

      <CompetitorsDrawer
        isOpen={competitorsOpen}
        onClose={() => setCompetitorsOpen(false)}
        product={competitorsProduct}
        reportingCurrency={sellerReportingCurrency}
      />
    </>
  );
}
