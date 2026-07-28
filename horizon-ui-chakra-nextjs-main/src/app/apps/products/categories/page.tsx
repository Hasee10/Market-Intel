'use client';

import { Icon, SimpleGrid, Skeleton, Stack, Text } from '@chakra-ui/react';
import { MdOutlineSearchOff } from 'react-icons/md';

import Card from 'components/card/Card';

import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { useFetch } from '@/lib/hooks/useApi';
import { PATH_DASHBOARD, PATH_APPS } from '@/lib/paths';
import { IApiResponse } from '@/types/api-response';
import { IProductCategory } from '@/types/products';

import { CategoryCard } from './components/CategoryCard';

const breadcrumbItems = [
  { title: 'Dashboard', href: PATH_DASHBOARD.default },
  { title: 'Products', href: PATH_APPS.products.root },
  { title: 'Categories', href: '#' },
];

export default function CategoriesPage() {
  const {
    data: categoriesData,
    loading: categoriesLoading,
    error: categoriesError,
  } = useFetch<IApiResponse<IProductCategory[]>>('/api/product-categories');

  const renderContent = () => {
    if (categoriesLoading) {
      return (
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="20px">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={`category-loading-${i}`} height="120px" borderRadius="16px" />
          ))}
        </SimpleGrid>
      );
    }

    if (categoriesError || !categoriesData?.succeeded) {
      return (
        <ErrorAlert
          title="Error loading categories"
          message={categoriesData?.errors?.join(', ') || categoriesError?.message}
        />
      );
    }

    if (!categoriesData?.data?.length) {
      return (
        <Card>
          <Stack align="center" spacing="8px" py="24px">
            <Icon as={MdOutlineSearchOff} boxSize="28px" color="secondaryGray.600" />
            <Text fontSize="lg" fontWeight="700">
              No categories found
            </Text>
            <Text color="secondaryGray.600">Categories will appear here once configured.</Text>
          </Stack>
        </Card>
      );
    }

    return (
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="20px">
        {categoriesData.data.map((category) => (
          <CategoryCard key={category.id} data={category} />
        ))}
      </SimpleGrid>
    );
  };

  return (
    <>
      <PageHeader title="Product Categories" breadcrumbItems={breadcrumbItems} />
      {renderContent()}
    </>
  );
}
