'use client';

import {
  Container,
  Grid,
  PaperProps,
  Stack,
  Text,
  Title,
  Group,
} from '@mantine/core';

import {
  PageHeader,
  StatsGrid,
  Surface,
  TopProductsTable,
  OrderStatusChart,
  CategoryRevenueChart,
  RevenueChart,
} from '@/components';
import { useFetch } from '@mantine/hooks';
import { IApiResponse } from '@/types/api-response';

const PAPER_PROPS: PaperProps = {
  p: 'md',
  style: { minHeight: '100%' },
};

function Page() {
  const {
    data: statsData,
    error: statsError,
    loading: statsLoading,
  } = useFetch<IApiResponse<any[]>>('/api/ecommerce/stats');

  const {
    data: productsData,
    error: productsError,
    loading: productsLoading,
  } = useFetch<IApiResponse<any[]>>('/api/ecommerce/products');

  const {
    data: ordersData,
    error: ordersError,
    loading: ordersLoading,
  } = useFetch<IApiResponse<any[]>>('/api/ecommerce/orders');

  const {
    data: categoriesData,
    error: categoriesError,
    loading: categoriesLoading,
  } = useFetch<IApiResponse<any[]>>('/api/ecommerce/categories');

  const {
    data: revenueTrendData,
    error: revenueTrendError,
    loading: revenueTrendLoading,
  } = useFetch<IApiResponse<any[]>>('/api/ecommerce/revenue-trend');

  return (
    <>
      <>
        <title>Overview | Market Intel</title>
        <meta
          name="description"
          content="Your store at a glance: revenue, order status, top products, and category performance."
        />
      </>
      <Container fluid>
        <Stack gap="lg">
          <PageHeader title="Overview" withActions={true} />

          <StatsGrid
            data={statsData?.data || []}
            error={statsError}
            loading={statsLoading}
            paperProps={PAPER_PROPS}
          />

          <Stack gap="sm">
            <Title order={4}>Revenue & fulfillment</Title>
            <Grid>
              <Grid.Col span={{ base: 12, md: 8 }}>
                <RevenueChart
                  data={revenueTrendData?.data || []}
                  error={revenueTrendError}
                  loading={revenueTrendLoading}
                  {...PAPER_PROPS}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Surface {...PAPER_PROPS}>
                  <Text size="lg" fw={600} mb="md">
                    Order Status
                  </Text>
                  <OrderStatusChart
                    data={ordersData?.data || []}
                    error={ordersError}
                    loading={ordersLoading}
                  />
                </Surface>
              </Grid.Col>
            </Grid>
          </Stack>

          <Stack gap="sm">
            <Title order={4}>Products & inventory</Title>
            <Grid>
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Surface {...PAPER_PROPS}>
                  <CategoryRevenueChart
                    data={categoriesData?.data || []}
                    error={categoriesError}
                    loading={categoriesLoading}
                  />
                </Surface>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 7 }}>
                <Surface {...PAPER_PROPS}>
                  <Group justify="space-between" mb="md">
                    <Text size="lg" fw={600}>
                      Top Products by Inventory Value
                    </Text>
                  </Group>
                  <TopProductsTable
                    data={productsData?.data?.slice(0, 5) || []}
                    error={productsError}
                    loading={productsLoading}
                  />
                </Surface>
              </Grid.Col>
            </Grid>
          </Stack>
        </Stack>
      </Container>
    </>
  );
}

export default Page;
