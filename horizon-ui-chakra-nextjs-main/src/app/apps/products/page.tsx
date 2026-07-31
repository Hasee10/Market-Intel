'use client';

import { useCallback, useState } from 'react';

import { Box, Button, Flex, Icon, SimpleGrid, Skeleton, Stack, Text } from '@chakra-ui/react';
import { MdAddCircleOutline, MdGridView, MdOutlineSearchOff, MdUploadFile, MdViewList } from 'react-icons/md';

import Card from 'components/card/Card';

import { BulkImportDrawer, ImportField } from '@/components/marketintel/BulkImportDrawer';
import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { ProductsTable } from '@/components/marketintel/ProductsTable';
import { useFetch } from '@/lib/hooks/useApi';
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

const IMPORT_FIELDS: ImportField[] = [
  { key: 'sku', label: 'SKU', required: true },
  { key: 'title', label: 'Title', required: true },
  { key: 'costPrice', label: 'Cost price', type: 'number' },
  { key: 'sellPrice', label: 'Sell price', type: 'number' },
  { key: 'stockQty', label: 'Stock quantity', type: 'number' },
  { key: 'isActive', label: 'Active (yes/no)', type: 'boolean' },
];

export default function ProductsPage() {
  const [selectedProduct, setSelectedProduct] = useState<IProduct | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const {
    data: productsData,
    loading: productsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useFetch<IApiResponse<IProduct[]>>('/api/products');

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

  const renderContent = () => {
    if (productsLoading) {
      return viewMode === 'grid' ? (
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="20px">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={`product-loading-${i}`} height="220px" borderRadius="16px" />
          ))}
        </SimpleGrid>
      ) : (
        <Card>
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
        <Card>
          <Stack align="center" spacing="8px" py="24px">
            <Icon as={MdOutlineSearchOff} boxSize="28px" color="secondaryGray.600" />
            <Text fontSize="lg" fontWeight="700">
              No products found
            </Text>
            <Text color="secondaryGray.600">
              You don&apos;t have any products yet. Create one to get started.
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
        {productsData.data.map((p) => (
          <ProductCard key={p.id} data={p} onEdit={handleEditProduct} />
        ))}
      </SimpleGrid>
    ) : (
      <Card>
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
        fields={IMPORT_FIELDS}
        apiEndpoint="/api/products/bulk-import"
        onImported={handleProductCreated}
      />
    </>
  );
}
