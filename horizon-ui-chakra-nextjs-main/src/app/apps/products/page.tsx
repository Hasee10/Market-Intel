'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';

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
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { Reveal } from 'components/reactbits/Reveal';

import { BulkImportDrawer, ImportField } from '@/components/marketintel/BulkImportDrawer';
import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { InsightStrip, type Insight } from '@/components/marketintel/InsightStrip';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { ProductsTable } from '@/components/marketintel/ProductsTable';
import { useFetch, useProfile } from '@/lib/hooks/useApi';
import { getCountryProductConfig } from '@/lib/market-intel/core/countries';
import { PATH_DASHBOARD } from '@/lib/paths';
import { IApiResponse } from '@/types/api-response';
import { IProduct } from '@/types/products';

import { CompetitorsDrawer } from './components/CompetitorsDrawer';
import { EditProductDrawer } from './components/EditProductDrawer';
import { NewProductDrawer } from './components/NewProductDrawer';
import { ProductCard } from './components/ProductCard';

type ViewMode = 'grid' | 'table';

const breadcrumbItems = [
  { title: 'Dashboard', href: PATH_DASHBOARD.default },
  { title: 'Products', href: '#' },
];

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

// useSearchParams() (for ?categoryId=&categoryName=, arriving via a click
// from the Categories page) forces this into a client-side-rendered
// boundary during prerendering, same reason as auth/signup/page.tsx - the
// actual page lives in ProductsPageContent below, this default export is
// just the Suspense wrapper.
export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsPageContent />
    </Suspense>
  );
}

function ProductsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryFilterId = searchParams.get('categoryId');
  const categoryFilterName = searchParams.get('categoryName');

  const [selectedProduct, setSelectedProduct] = useState<IProduct | null>(null);
  const [competitorsProduct, setCompetitorsProduct] = useState<IProduct | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [competitorsOpen, setCompetitorsOpen] = useState(false);

  const apiUrl = categoryFilterId ? `/api/products?categoryId=${categoryFilterId}` : '/api/products';
  const {
    data: productsData,
    loading: productsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useFetch<IApiResponse<IProduct[]>>(apiUrl);

  // Both views below rendered every product the API returned, and
  // /api/products has no limit - a seller who CSV-imports a catalogue gets
  // the whole thing in one grid or one table. One page state shared by both
  // views, so switching between them keeps your place instead of jumping.
  const products = useMemo(() => productsData?.data ?? [], [productsData]);
  const productPage = usePagination(products, 12);

  const { data: profileData } = useProfile();
  const sellerCountry = profileData?.data?.country;
  const sellerReportingCurrency = profileData?.data?.reportingCurrency ?? 'PKR';
  const importFields = useMemo(
    () => buildImportFields(getCountryProductConfig(sellerCountry).skuRequired, sellerReportingCurrency),
    [sellerCountry, sellerReportingCurrency],
  );

  const handleProductCreated = useCallback(() => {
    refetchProducts();
  }, [refetchProducts]);

  const handleProductUpdated = useCallback(() => {
    refetchProducts();
  }, [refetchProducts]);

  const handleEditProduct = (product: IProduct) => {
    setSelectedProduct(product);
    setEditOpen(true);
  };

  const handleViewCompetitors = (product: IProduct) => {
    setCompetitorsProduct(product);
    setCompetitorsOpen(true);
  };

  const clearCategoryFilter = () => router.push('/apps/products');

  const renderContent = () => {
    if (productsLoading) {
      return viewMode === 'grid' ? (
        <div className="@container grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4 md:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`product-loading-${i}`}
              className="h-[220px] animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      ) : (
        <Card>
          <ProductsTable data={[]} loading onEdit={handleEditProduct} onViewCompetitors={handleViewCompetitors} />
        </Card>
      );
    }

    if (productsError || !productsData?.succeeded) {
      return (
        <ErrorAlert
          title="Error loading products"
          message={productsData?.errors?.join(', ') || productsError?.message}
        />
      );
    }

    if (!productsData?.data?.length) {
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
            <Reveal key={p.id} delay={Math.min(i, 12) * 40} h="100%">
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
            {productsData?.data && productsData.data.length > 0 && (
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

      {!productsLoading && productsData?.succeeded && productsData.data && productsData.data.length > 0 && (
        <InsightStrip insight={computeProductsInsight(productsData.data)} />
      )}

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

      <NewProductDrawer
        isOpen={newOpen}
        onClose={() => setNewOpen(false)}
        onProductCreated={handleProductCreated}
      />

      <EditProductDrawer
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        product={selectedProduct}
        onProductUpdated={handleProductUpdated}
      />

      <BulkImportDrawer
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="products"
        fields={importFields}
        apiEndpoint="/api/products/bulk-import"
        onImported={handleProductCreated}
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
