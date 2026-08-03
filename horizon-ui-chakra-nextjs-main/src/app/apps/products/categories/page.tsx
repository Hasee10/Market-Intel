'use client';

import { Box, Flex, Icon, SimpleGrid, Skeleton, Stack, Text, Wrap, WrapItem, useColorModeValue } from '@chakra-ui/react';
import { MdOutlineSearchOff } from 'react-icons/md';

import Card from 'components/card/Card';
import { Reveal } from 'components/reactbits/Reveal';

import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { useFetch } from '@/lib/hooks/useApi';
import { PATH_DASHBOARD, PATH_APPS } from '@/lib/paths';
import { IApiResponse } from '@/types/api-response';
import { IProductCategory } from '@/types/products';

import { CategoryCard } from './components/CategoryCard';
import { EmptyCategoryChip } from './components/EmptyCategoryChip';

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

  const sectionLabel = useColorModeValue('secondaryGray.600', 'secondaryGray.500');

  const renderContent = () => {
    if (categoriesLoading) {
      return (
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="20px">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={`category-loading-${i}`} height="140px" borderRadius="16px" />
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

    // Split instead of one flat sorted grid: a category with real inventory
    // and one with zero products aren't the same kind of thing, and giving
    // them identical card treatment was the actual "flat" problem here -
    // 7 of 12 categories looked exactly as important as the 5 that weren't
    // empty.
    const populated = categoriesData.data
      .filter((c) => c.productCount > 0)
      .sort((a, b) => b.productCount - a.productCount);
    const empty = categoriesData.data.filter((c) => c.productCount === 0);
    const maxProductCount = populated[0]?.productCount ?? 0;

    return (
      <>
        {populated.length > 0 && (
          <Box mb={empty.length > 0 ? '36px' : '0'}>
            <Text fontSize="xs" fontWeight="700" color={sectionLabel} textTransform="uppercase" letterSpacing="0.06em" mb="14px">
              Categories with products
            </Text>
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="20px">
              {populated.map((category, i) => (
                <Reveal key={category.id} delay={i * 60} h="100%">
                  <CategoryCard data={category} maxProductCount={maxProductCount} />
                </Reveal>
              ))}
            </SimpleGrid>
          </Box>
        )}

        {empty.length > 0 && (
          <Box>
            <Text fontSize="xs" fontWeight="700" color={sectionLabel} textTransform="uppercase" letterSpacing="0.06em" mb="14px">
              Not started yet
            </Text>
            <Wrap spacing="10px">
              {empty.map((category) => (
                <WrapItem key={category.id}>
                  <EmptyCategoryChip data={category} />
                </WrapItem>
              ))}
            </Wrap>
          </Box>
        )}
      </>
    );
  };

  const activeCount = categoriesData?.data?.filter((c) => c.productCount > 0).length ?? 0;
  const totalCount = categoriesData?.data?.length ?? 0;
  const totalProducts = categoriesData?.data?.reduce((sum, c) => sum + c.productCount, 0) ?? 0;

  return (
    <>
      <PageHeader title="Product Categories" breadcrumbItems={breadcrumbItems} />
      {totalCount > 0 && (
        <Flex align="center" gap="8px" mb="24px" mt="-12px" wrap="wrap">
          <Text fontSize="sm" color="secondaryGray.600">
            <Text as="span" fontWeight="700" color="brand.500">
              {activeCount}
            </Text>{' '}
            of {totalCount} categories have products
            {totalProducts > 0 && (
              <>
                {' '}
                (
                <Text as="span" fontWeight="700" color="brand.500">
                  {totalProducts}
                </Text>{' '}
                product{totalProducts === 1 ? '' : 's'} total)
              </>
            )}
            {' '}- click any category to see (or add) its products.
          </Text>
        </Flex>
      )}
      {renderContent()}
    </>
  );
}
