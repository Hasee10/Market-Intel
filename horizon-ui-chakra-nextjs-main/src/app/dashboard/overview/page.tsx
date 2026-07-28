'use client';

import {
  Box,
  Flex,
  Grid,
  GridItem,
  Heading,
  SimpleGrid,
  Skeleton,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';

import Card from 'components/card/Card';
import PieChart from 'components/charts/PieChart';
import LineChart from 'components/charts/LineChart';

import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { StatsGrid, StatItem } from '@/components/marketintel/StatsGrid';
import { useFetch } from '@/lib/hooks/useApi';
import { IApiResponse } from '@/types/api-response';

type OrderStatusRow = { status: string; count: number; value: number; percentage: number };
type CategoryRow = { category: string; value: number; products: number; percentage: number };
type TopProductRow = {
  id: string;
  title: string;
  sku: string | null;
  category: string;
  sellPrice: number;
  stockQty: number;
  inventoryValue: number;
};
type RevenuePoint = { date: string; revenue: number };

const PALETTE = [
  '#4318FF',
  '#6AD2FF',
  '#05CD99',
  '#FFB547',
  '#EE5D50',
  '#8B5CF6',
  '#F97316',
  '#22D3EE',
];

function formatCurrency(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default function OverviewPage() {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const cardBg = useColorModeValue('white', 'navy.700');

  const { data: statsData, loading: statsLoading } = useFetch<IApiResponse<StatItem[]>>(
    '/api/ecommerce/stats',
  );
  const { data: productsData, loading: productsLoading } = useFetch<
    IApiResponse<TopProductRow[]>
  >('/api/ecommerce/products');
  const { data: ordersData, loading: ordersLoading } = useFetch<IApiResponse<OrderStatusRow[]>>(
    '/api/ecommerce/orders',
  );
  const { data: categoriesData, loading: categoriesLoading } = useFetch<
    IApiResponse<CategoryRow[]>
  >('/api/ecommerce/categories');
  const { data: revenueTrendData, loading: revenueLoading } = useFetch<
    IApiResponse<RevenuePoint[]>
  >('/api/ecommerce/revenue-trend');

  const allLoaded = ![
    statsLoading,
    productsLoading,
    ordersLoading,
    categoriesLoading,
    revenueLoading,
  ].some(Boolean);

  const authFailed =
    allLoaded &&
    [statsData, productsData, ordersData, categoriesData, revenueTrendData].every(
      (res) => res && res.succeeded === false,
    );

  if (authFailed) {
    return (
      <ErrorAlert
        title="Error loading dashboard"
        message={statsData?.errors?.join(', ') || 'Not authenticated'}
      />
    );
  }

  const orders = ordersData?.data || [];
  const categories = categoriesData?.data || [];
  const revenueTrend = revenueTrendData?.data || [];
  const topProducts = (productsData?.data || []).slice(0, 5);

  const lineChartData = [
    {
      name: 'Revenue',
      data: revenueTrend.map((p) => Number(p.revenue.toFixed(2))),
    },
  ];
  const lineChartOptions = {
    chart: { toolbar: { show: false } },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    xaxis: {
      categories: revenueTrend.map((p) => p.date.slice(5)),
      labels: { style: { colors: '#A3AED0', fontSize: '10px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { show: false },
    grid: { show: false },
    colors: ['#4318FF'],
    tooltip: { theme: 'dark' },
  };

  const orderPieData = orders.map((o) => o.count);
  const orderPieOptions = {
    labels: orders.map((o) => o.status),
    colors: PALETTE.slice(0, orders.length || 1),
    legend: { show: true, position: 'bottom' as const },
    dataLabels: { enabled: false },
  };

  const categoryPieData = categories.map((c) => c.value);
  const categoryPieOptions = {
    labels: categories.map((c) => c.category),
    colors: PALETTE.slice(0, categories.length || 1),
    legend: { show: true, position: 'bottom' as const },
    dataLabels: { enabled: false },
  };

  return (
    <Box>
      <PageHeader title="Overview" />

      <StatsGrid data={statsData?.data || []} loading={statsLoading} columns={3} />

      <Heading size="md" color={textColor} mb="12px" mt="8px">
        Revenue & fulfillment
      </Heading>
      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap="20px" mb="20px">
        <Card>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="10px">
            Revenue trend (30 days)
          </Text>
          {revenueLoading ? (
            <Skeleton height="260px" />
          ) : revenueTrend.length === 0 ? (
            <Text color="secondaryGray.600">No revenue data yet.</Text>
          ) : (
            <Box h="260px">
              <LineChart chartData={lineChartData} chartOptions={lineChartOptions} />
            </Box>
          )}
        </Card>
        <Card>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="10px">
            Order status
          </Text>
          {ordersLoading ? (
            <Skeleton height="260px" />
          ) : orders.length === 0 ? (
            <Text color="secondaryGray.600">No orders yet.</Text>
          ) : (
            <Box h="260px">
              <PieChart chartData={orderPieData} chartOptions={orderPieOptions} />
            </Box>
          )}
        </Card>
      </Grid>

      <Heading size="md" color={textColor} mb="12px" mt="8px">
        Products & inventory
      </Heading>
      <Grid templateColumns={{ base: '1fr', lg: '5fr 7fr' }} gap="20px">
        <Card>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="10px">
            Category inventory value
          </Text>
          {categoriesLoading ? (
            <Skeleton height="260px" />
          ) : categories.length === 0 ? (
            <Text color="secondaryGray.600">No active products yet.</Text>
          ) : (
            <Box h="260px">
              <PieChart chartData={categoryPieData} chartOptions={categoryPieOptions} />
            </Box>
          )}
        </Card>
        <Card>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="10px">
            Top products by inventory value
          </Text>
          {productsLoading ? (
            <Skeleton height="260px" />
          ) : topProducts.length === 0 ? (
            <Text color="secondaryGray.600">No products yet.</Text>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Title</Th>
                    <Th>Category</Th>
                    <Th isNumeric>Sell price</Th>
                    <Th isNumeric>Stock</Th>
                    <Th isNumeric>Inventory value</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {topProducts.map((p) => (
                    <Tr key={p.id}>
                      <Td>{p.title}</Td>
                      <Td>{p.category}</Td>
                      <Td isNumeric>{formatCurrency(p.sellPrice)}</Td>
                      <Td isNumeric>{p.stockQty}</Td>
                      <Td isNumeric>{formatCurrency(p.inventoryValue)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </Card>
      </Grid>
    </Box>
  );
}
