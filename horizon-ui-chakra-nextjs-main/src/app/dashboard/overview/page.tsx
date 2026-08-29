'use client';

import NextLink from 'next/link';
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  Icon,
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
import { MdAddCircleOutline, MdOutlineInsertChart } from 'react-icons/md';

import Card from 'components/card/Card';
import PieChart from 'components/charts/PieChart';
import LineChart from 'components/charts/LineChart';

import { DownloadReportButton } from '@/components/marketintel/DownloadReportButton';
import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { InsightBanner } from '@/components/marketintel/InsightBanner';
import { OnboardingChecklist } from '@/components/marketintel/OnboardingChecklist';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { StatsGrid, StatItem } from '@/components/marketintel/StatsGrid';
import { useFetch } from '@/lib/hooks/useApi';
import { PATH_APPS } from '@/lib/paths';
import { IApiResponse } from '@/types/api-response';
import type { OrderAnomaly } from '@/lib/market-intel/anomalies';
import type { RevenueForecast } from '@/lib/market-intel/forecast';

// Shared empty-state pattern: icon + reason + a single next action, not
// just flat "No X yet" text with nowhere to go.
function ChartEmptyState({ message, ctaLabel, ctaHref }: { message: string; ctaLabel: string; ctaHref: string }) {
  return (
    <Flex direction="column" align="center" justify="center" h="260px" gap="10px">
      <Icon as={MdOutlineInsertChart} boxSize="32px" color="secondaryGray.400" />
      <Text color="secondaryGray.600" textAlign="center">
        {message}
      </Text>
      <Button as={NextLink} href={ctaHref} size="sm" variant="outline" leftIcon={<Icon as={MdAddCircleOutline} />}>
        {ctaLabel}
      </Button>
    </Flex>
  );
}

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
  currency: string;
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

// Every amount reaching this page has already been converted server-side
// into the seller's reporting currency (see lib/market-intel/fx.ts) - this
// just needs the currency code to format it, not do any conversion itself.
function formatCurrency(v: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);
}

export default function OverviewPage() {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const cardBg = useColorModeValue('white', 'navy.700');
  const cardBorder = useColorModeValue('gray.100', 'whiteAlpha.100');
  const cardShadow = useColorModeValue('0px 4px 16px rgba(17, 28, 78, 0.04)', 'none');
  const sectionAccent = useColorModeValue('#4318FF', '#A594FF');
  const donutLabelColor = useColorModeValue('#1B2559', '#FFFFFF');
  const donutTotalColor = useColorModeValue('#A3AED0', '#A3AED0');
  const tableRowHoverBg = useColorModeValue('#FAFAFF', 'whiteAlpha.50');
  const categoryBadgeBg = useColorModeValue('#F0EDFF', 'whiteAlpha.100');
  const categoryBadgeColor = useColorModeValue('#4318FF', '#A594FF');
  // Chart tooltips previously hardcoded `theme: 'dark'` unconditionally -
  // even in light mode - and ApexCharts' generic dark preset (a flat grey,
  // not this app's specific navy) sat close enough in luminance to Ryvl's
  // actual dark surface that the tooltip box read as barely-there against
  // the page behind it. These match cardBg/cardBorder/textColor exactly
  // (navy.700 = #1B254B, from theme/styles.ts), as raw hex because
  // ApexCharts' tooltip.custom returns an HTML string, not JSX - Chakra
  // tokens like "navy.700" aren't resolvable CSS outside a styled component.
  const tooltipBg = useColorModeValue('#FFFFFF', '#1B254B');
  const tooltipBorder = useColorModeValue('#E2E8F0', 'rgba(255,255,255,0.14)');
  const tooltipText = useColorModeValue('#1B2559', '#FFFFFF');
  const tooltipMuted = useColorModeValue('#707EAE', '#A3AED0');

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
  const { data: anomaliesData } = useFetch<IApiResponse<OrderAnomaly[]>>('/api/anomalies/revenue');
  const { data: forecastData } = useFetch<IApiResponse<RevenueForecast | null>>('/api/forecast/revenue');

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
  const anomalies = anomaliesData?.data || [];
  const recentAnomaly = anomalies[0];
  const forecast = forecastData?.data ?? null;
  // Every stat/anomaly/forecast/product amount is already converted
  // server-side into this currency - derived from whichever response
  // happens to have loaded first, since they all agree on the same value.
  const reportingCurrency = topProducts[0]?.currency ?? 'PKR';

  const allStats = statsData?.data || [];
  const SECONDARY_STAT_TITLES = new Set(['Active Products', 'Low Stock Products']);
  const primaryStats = allStats.filter((s) => !SECONDARY_STAT_TITLES.has(s.title));
  const activeProductsStat = allStats.find((s) => s.title === 'Active Products');
  const lowStockStat = allStats.find((s) => s.title === 'Low Stock Products');

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
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 90, 100] },
    },
    markers: { size: 0, hover: { size: 5 } },
    xaxis: {
      categories: revenueTrend.map((p) => p.date.slice(5)),
      labels: { style: { colors: '#A3AED0', fontSize: '10px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { show: false },
    grid: { show: false },
    colors: ['#4318FF'],
    tooltip: {
      custom: ({ series, seriesIndex, dataPointIndex }: { series: number[][]; seriesIndex: number; dataPointIndex: number }) => {
        const point = revenueTrend[dataPointIndex];
        const value = series[seriesIndex]?.[dataPointIndex] ?? 0;
        return `<div style="background:${tooltipBg};border:1px solid ${tooltipBorder};border-radius:10px;padding:8px 12px;box-shadow:0 4px 16px rgba(17,28,78,0.16);font-family:inherit;">
          <div style="color:${tooltipMuted};font-size:11px;margin-bottom:2px;">${point?.date ?? ''}</div>
          <div style="color:${tooltipText};font-size:13px;font-weight:700;">${formatCurrency(value, reportingCurrency)}</div>
        </div>`;
      },
    },
  };

  const orderPieData = orders.map((o) => o.count);
  const totalOrderCount = orderPieData.reduce((sum, v) => sum + v, 0);
  const orderPieOptions = {
    labels: orders.map((o) => o.status),
    colors: PALETTE.slice(0, orders.length || 1),
    legend: { show: true, position: 'bottom' as const, labels: { colors: tooltipText } },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          labels: {
            show: true,
            value: { fontSize: '22px', fontWeight: '800', color: donutLabelColor, offsetY: -4 },
            total: {
              show: true,
              label: 'Orders',
              fontSize: '12px',
              color: donutTotalColor,
              formatter: () => String(totalOrderCount),
            },
          },
        },
      },
    },
  };

  // Phase 2 (enterprise-look pass): the seller's own category list can run
  // up to all 13 platform categories - a donut with a 13-colour legend at
  // this size is illegible to anyone, not just non-technical users. `categories`
  // already arrives sorted by value desc (route.ts), so this is just "keep
  // the top 5, fold the rest into one Other slice" - the chart still
  // accounts for 100% of inventory value, it just stops trying to name
  // every sliver of it.
  const CHART_CATEGORY_LIMIT = 5;
  const topCategories = categories.slice(0, CHART_CATEGORY_LIMIT);
  const otherCategoriesValue = categories.slice(CHART_CATEGORY_LIMIT).reduce((sum, c) => sum + c.value, 0);
  const chartCategories =
    otherCategoriesValue > 0
      ? [...topCategories, { category: 'Other', value: otherCategoriesValue, products: 0, percentage: 0 }]
      : topCategories;

  const categoryPieData = chartCategories.map((c) => c.value);
  const totalCategoryValue = categoryPieData.reduce((sum, v) => sum + v, 0);
  const categoryPieOptions = {
    labels: chartCategories.map((c) => c.category),
    colors: PALETTE.slice(0, chartCategories.length || 1),
    legend: { show: true, position: 'bottom' as const, labels: { colors: tooltipText } },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          labels: {
            show: true,
            value: { fontSize: '16px', fontWeight: '800', color: donutLabelColor, offsetY: -4 },
            total: {
              show: true,
              label: 'Total value',
              fontSize: '12px',
              color: donutTotalColor,
              formatter: () => formatCurrency(totalCategoryValue, reportingCurrency),
            },
          },
        },
      },
    },
  };

  return (
    <Box>
      <PageHeader title="Overview" actionButton={<DownloadReportButton />} />

      <OnboardingChecklist />

      {allLoaded && (
        <InsightBanner
          stats={statsData?.data || []}
          anomaly={recentAnomaly}
          forecast={forecast}
          currency={reportingCurrency}
        />
      )}

      {/* Phase 2 (enterprise-look pass): the primary KPI row is now the 4
          stats that actually have a month-over-month story to tell
          (Revenue/Orders/AOV/New customers all carry a diff%) - Active
          Products and Low Stock are inventory *state*, not trend, and sit
          as a compact strip beside the Products & Inventory heading
          instead, where they're contextually relevant. Six same-weight
          cards buried the two that matter most for "is my store doing
          well" behind two that don't move month to month. Named lookups,
          not positional slicing, so a reordered API response can't
          silently split the wrong stats. */}
      <StatsGrid data={primaryStats} loading={statsLoading} columns={4} />

      <Flex align="center" gap="10px" mb="14px" mt="12px">
        <Box w="4px" h="18px" borderRadius="full" bg={sectionAccent} />
        <Heading size="md" color={textColor} fontFamily="var(--font-merriweather), serif">
          Revenue & fulfillment
        </Heading>
      </Flex>
      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap="20px" mb="20px">
        <Card border="1px solid" borderColor={cardBorder} boxShadow={cardShadow}>
          <Flex justify="space-between" align="center" mb="10px">
            <Text fontSize="lg" fontWeight="600" color={textColor}>
              Revenue trend {forecast ? '& 14-day forecast' : '(30 days)'}
            </Text>
            {forecast && (
              <Badge colorScheme={forecast.trendDirection === 'up' ? 'green' : forecast.trendDirection === 'down' ? 'red' : 'gray'}>
                {forecast.trendDirection === 'flat'
                  ? 'Stable'
                  : `${forecast.trendDirection === 'up' ? '+' : ''}${formatCurrency(forecast.changePerWeek, reportingCurrency)}/wk`}
              </Badge>
            )}
          </Flex>
          {revenueLoading ? (
            <Skeleton height="260px" />
          ) : forecast ? (
            <Box h="260px">
              <LineChart
                type="area"
                chartData={[
                  {
                    name: 'Revenue',
                    data: forecast.points.map((p) => (p.isProjected ? null : Number(p.value.toFixed(2)))),
                  },
                  {
                    name: 'Forecast',
                    data: forecast.points.map((p, i) =>
                      p.isProjected || i === forecast.points.findIndex((x) => x.isProjected) - 1
                        ? Number(p.value.toFixed(2))
                        : null,
                    ),
                  },
                ]}
                chartOptions={{
                  chart: { toolbar: { show: false } },
                  dataLabels: { enabled: false },
                  stroke: { curve: 'smooth', width: [3, 3], dashArray: [0, 6] },
                  // Only the actual-revenue series gets the area fill - a
                  // filled projected segment would read as if the forecast
                  // were as certain as the real data next to it.
                  fill: {
                    type: ['gradient', 'solid'],
                    gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 90, 100] },
                    opacity: [1, 0],
                  },
                  markers: { size: 0, hover: { size: 5 } },
                  xaxis: {
                    categories: forecast.points.map((p) => p.date.slice(5)),
                    labels: { style: { colors: '#A3AED0', fontSize: '10px' } },
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                  },
                  yaxis: { show: false },
                  grid: { show: false },
                  colors: ['#4318FF', '#A3AED0'],
                  tooltip: {
                    custom: ({ series, dataPointIndex }: { series: number[][]; dataPointIndex: number }) => {
                      const point = forecast.points[dataPointIndex];
                      // At the actual->projected transition point both
                      // series carry the same value (see the chartData
                      // above) so the dashed line connects seamlessly -
                      // show it once, labelled by which it really is.
                      const isProjected = point?.isProjected;
                      const value = isProjected ? series[1]?.[dataPointIndex] : series[0]?.[dataPointIndex];
                      return `<div style="background:${tooltipBg};border:1px solid ${tooltipBorder};border-radius:10px;padding:8px 12px;box-shadow:0 4px 16px rgba(17,28,78,0.16);font-family:inherit;">
                        <div style="color:${tooltipMuted};font-size:11px;margin-bottom:2px;">${point?.date ?? ''}${isProjected ? ' (projected)' : ''}</div>
                        <div style="color:${tooltipText};font-size:13px;font-weight:700;">${formatCurrency(value ?? 0, reportingCurrency)}</div>
                      </div>`;
                    },
                  },
                }}
              />
            </Box>
          ) : revenueTrend.length === 0 ? (
            <ChartEmptyState
              message="No revenue data yet - record your first order to see a trend here."
              ctaLabel="Add an order"
              ctaHref={PATH_APPS.orders}
            />
          ) : (
            <Box h="260px">
              <LineChart type="area" chartData={lineChartData} chartOptions={lineChartOptions} />
            </Box>
          )}
        </Card>
        <Card border="1px solid" borderColor={cardBorder} boxShadow={cardShadow}>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="10px">
            Order status
          </Text>
          {ordersLoading ? (
            <Skeleton height="260px" />
          ) : orders.length === 0 ? (
            <ChartEmptyState
              message="No orders yet - add one to see fulfillment status here."
              ctaLabel="Add an order"
              ctaHref={PATH_APPS.orders}
            />
          ) : (
            <Box h="260px">
              <PieChart type="donut" chartData={orderPieData} chartOptions={orderPieOptions} />
            </Box>
          )}
        </Card>
      </Grid>

      <Flex align="center" justify="space-between" wrap="wrap" gap="12px" mb="14px" mt="12px">
        <Flex align="center" gap="10px">
          <Box w="4px" h="18px" borderRadius="full" bg={sectionAccent} />
          <Heading size="md" color={textColor} fontFamily="var(--font-merriweather), serif">
            Products & inventory
          </Heading>
        </Flex>
        {!statsLoading && (activeProductsStat || lowStockStat) && (
          <Flex gap="20px">
            {activeProductsStat && (
              <Flex align="baseline" gap="6px">
                <Text fontSize="lg" fontWeight="700" color={textColor}>
                  {activeProductsStat.value}
                </Text>
                <Text fontSize="xs" color="secondaryGray.600">
                  active{activeProductsStat.period ? ` (${activeProductsStat.period})` : ''}
                </Text>
              </Flex>
            )}
            {lowStockStat && (
              <Flex align="baseline" gap="6px">
                <Text
                  fontSize="lg"
                  fontWeight="700"
                  // Low stock is the one inventory figure that's a warning
                  // above zero - everywhere else on this page, colour means
                  // trend direction; here it means "needs attention".
                  color={Number(lowStockStat.value.replace(/,/g, '')) > 0 ? 'orange.500' : textColor}
                >
                  {lowStockStat.value}
                </Text>
                <Text fontSize="xs" color="secondaryGray.600">
                  low stock{lowStockStat.period ? ` (${lowStockStat.period})` : ''}
                </Text>
              </Flex>
            )}
          </Flex>
        )}
      </Flex>
      <Grid templateColumns={{ base: '1fr', lg: '5fr 7fr' }} gap="20px">
        <Card border="1px solid" borderColor={cardBorder} boxShadow={cardShadow}>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="10px">
            Category inventory value
          </Text>
          {categoriesLoading ? (
            <Skeleton height="260px" />
          ) : categories.length === 0 ? (
            <ChartEmptyState
              message="No active products yet - add one to see category breakdown here."
              ctaLabel="Add a product"
              ctaHref={PATH_APPS.products.root}
            />
          ) : (
            <Box h="260px">
              <PieChart type="donut" chartData={categoryPieData} chartOptions={categoryPieOptions} />
            </Box>
          )}
        </Card>
        <Card border="1px solid" borderColor={cardBorder} boxShadow={cardShadow}>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="10px">
            Top products by inventory value
          </Text>
          {productsLoading ? (
            <Skeleton height="260px" />
          ) : topProducts.length === 0 ? (
            <ChartEmptyState
              message="No products yet - add your catalog to rank by inventory value here."
              ctaLabel="Add a product"
              ctaHref={PATH_APPS.products.root}
            />
          ) : (
            <>
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
                      <Tr key={p.id} transition="background-color 0.15s ease" _hover={{ bg: tableRowHoverBg }}>
                        <Td fontWeight="600" color={textColor}>
                          {p.title}
                        </Td>
                        <Td>
                          <Badge borderRadius="full" px="10px" py="2px" fontSize="xs" fontWeight="600" bg={categoryBadgeBg} color={categoryBadgeColor}>
                            {p.category}
                          </Badge>
                        </Td>
                        <Td isNumeric>{formatCurrency(p.sellPrice, p.currency)}</Td>
                        <Td isNumeric>{p.stockQty}</Td>
                        <Td isNumeric fontWeight="700" color={textColor}>
                          {formatCurrency(p.inventoryValue, p.currency)}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
              {(productsData?.data?.length ?? 0) > topProducts.length && (
                <Flex justify="flex-end" mt="12px">
                  <Button as={NextLink} href={PATH_APPS.products.root} size="sm" variant="ghost" colorScheme="brand">
                    View all products →
                  </Button>
                </Flex>
              )}
            </>
          )}
        </Card>
      </Grid>
    </Box>
  );
}
