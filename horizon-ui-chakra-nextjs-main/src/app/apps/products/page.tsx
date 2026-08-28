'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';

import { Box, Button, Flex, Icon, SimpleGrid, Skeleton, Stack, Tag, TagCloseButton, TagLabel, Text, useColorModeValue } from '@chakra-ui/react';
import { MdAddCircleOutline, MdGridView, MdOutlineSearchOff, MdUploadFile, MdViewList } from 'react-icons/md';
import { useRouter, useSearchParams } from 'next/navigation';

import Card from 'components/card/Card';
import { Reveal } from 'components/reactbits/Reveal';

import { BulkImportDrawer, ImportField } from '@/components/marketintel/BulkImportDrawer';
import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { ProductsTable } from '@/components/marketintel/ProductsTable';
import { useFetch, useProfile } from '@/lib/hooks/useApi';
import { getCountryProductConfig } from '@/lib/market-intel/countries';
import { PATH_DASHBOARD } from '@/lib/paths';
import { IApiResponse } from '@/types/api-response';
import { IProduct } from '@/types/products';

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
  ];
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
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const cardBorder = useColorModeValue('gray.100', 'whiteAlpha.100');
  const cardShadow = useColorModeValue('0px 4px 16px rgba(17, 28, 78, 0.04)', 'none');

  const apiUrl = categoryFilterId ? `/api/products?categoryId=${categoryFilterId}` : '/api/products';
  const {
    data: productsData,
    loading: productsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useFetch<IApiResponse<IProduct[]>>(apiUrl);

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

  const clearCategoryFilter = () => router.push('/apps/products');

  const renderContent = () => {
    if (productsLoading) {
      return viewMode === 'grid' ? (
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="20px">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={`product-loading-${i}`} height="220px" borderRadius="16px" />
          ))}
        </SimpleGrid>
      ) : (
        <Card border="1px solid" borderColor={cardBorder} boxShadow={cardShadow}>
          <ProductsTable data={[]} loading onEdit={handleEditProduct} />
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
        <Card border="1px solid" borderColor={cardBorder} boxShadow={cardShadow}>
          <Stack align="center" spacing="8px" py="24px">
            <Icon as={MdOutlineSearchOff} boxSize="28px" color="secondaryGray.600" />
            <Text fontSize="lg" fontWeight="700">
              No products found
            </Text>
            <Text color="secondaryGray.600">
              {categoryFilterName
                ? `Nothing in ${categoryFilterName} yet. Add one to get started.`
                : "You don't have any products yet. Create one to get started."}
            </Text>
            <Button
              variant="brand"
              leftIcon={<Icon as={MdAddCircleOutline} />}
              onClick={() => setNewOpen(true)}
            >
              New Product
            </Button>
          </Stack>
        </Card>
      );
    }

    return viewMode === 'grid' ? (
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="20px">
        {productsData.data.map((p, i) => (
          <Reveal key={p.id} delay={Math.min(i, 12) * 40} h="100%">
            <ProductCard data={p} onEdit={handleEditProduct} />
          </Reveal>
        ))}
      </SimpleGrid>
    ) : (
      <Card border="1px solid" borderColor={cardBorder} boxShadow={cardShadow}>
        <Box overflowX="auto">
          <ProductsTable data={productsData.data} loading={false} onEdit={handleEditProduct} />
        </Box>
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="Products"
        breadcrumbItems={breadcrumbItems}
        actionButton={
          <Flex gap="8px">
            {productsData?.data && productsData.data.length > 0 && (
              <>
                <Button
                  variant={viewMode === 'grid' ? 'brand' : 'outline'}
                  onClick={() => setViewMode('grid')}
                  p="0"
                  w="40px"
                >
                  <Icon as={MdGridView} />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'brand' : 'outline'}
                  onClick={() => setViewMode('table')}
                  p="0"
                  w="40px"
                >
                  <Icon as={MdViewList} />
                </Button>
              </>
            )}
            <Button variant="outline" leftIcon={<Icon as={MdUploadFile} />} onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Button
              variant="brand"
              leftIcon={<Icon as={MdAddCircleOutline} />}
              onClick={() => setNewOpen(true)}
            >
              New Product
            </Button>
          </Flex>
        }
      />

      {categoryFilterName && (
        <Flex mb="16px">
          <Tag size="lg" borderRadius="full" variant="subtle" colorScheme="brand">
            <TagLabel>Category: {categoryFilterName}</TagLabel>
            <TagCloseButton onClick={clearCategoryFilter} />
          </Tag>
        </Flex>
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
    </>
  );
}
