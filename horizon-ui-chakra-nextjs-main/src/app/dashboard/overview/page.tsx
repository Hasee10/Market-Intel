'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useColorModeValue } from '@chakra-ui/react';
import { MdAddCircleOutline, MdOutlineInsertChart } from 'react-icons/md';

import PieChart from 'components/charts/PieChart';
import LineChart from 'components/charts/LineChart';

import { DownloadReportButton } from '@/components/marketintel/DownloadReportButton';
import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { InsightBanner } from '@/components/marketintel/InsightBanner';
import { OnboardingChecklist } from '@/components/marketintel/OnboardingChecklist';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { StatsGrid, StatItem } from '@/components/ui/StatsGrid';
import { useFetch } from '@/lib/hooks/useApi';
import { PATH_APPS } from '@/lib/paths';
import { IApiResponse } from '@/types/api-response';
import type { OrderAnomaly } from '@/lib/market-intel/anomalies';
import type { RevenueForecast } from '@/lib/market-intel/forecast';

// Shared empty-state pattern: icon + reason + a single next action, not
// just flat "No X yet" text with nowhere to go.
function ChartEmptyState({ message, ctaLabel, ctaHref }: { message: string; ctaLabel: string; ctaHref: string }) {
  return (
    <div className="flex h-[260px] flex-col items-center justify-center gap-2.5 px-4 text-center">
      <MdOutlineInsertChart className="size-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      <NextLink
        href={ctaHref}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300 dark:hover:text-brand-400"
      >
        <MdAddCircleOutline className="size-4" aria-hidden="true" />
        {ctaLabel}
      </NextLink>
    </div>
  );
}

const chartSkeleton = (
  <div className="h-[260px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
);

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

// Chart palette anchored on TailAdmin's brand-500 (#465FFF) so the charts
// match the rest of the dashboard - ApexCharts takes raw hex, not tokens.
const PALETTE = [
  '#465FFF',
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

// Axis labels need to stay short or they overlap: "PKR 1.2M", not
// "PKR 1,234,567.00".
function compactCurrency(v: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(v);
}

// "2026-08-05" -> "5 Aug". The previous `.slice(5)` produced "08-05", which
// is neither a date a seller reads at a glance nor sortable-looking.
function formatAxisDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Ranges the revenue trend can be narrowed to. The API returns 30 days, so
// these slice that client-side rather than refetching - honest about the
// data we already have instead of implying a longer history exists.
const TREND_RANGES = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
] as const;

export default function OverviewPage() {
  const [trendDays, setTrendDays] = useState<number>(30);
  // Only the values ApexCharts still needs survive here. Card borders, table
  // row hover, the section accent bar and the category badge all moved to
  // Tailwind classes in the markup below, so their useColorModeValue calls
  // were removed rather than left dangling.
  const cardBg = useColorModeValue('white', 'navy.700');
  const donutLabelColor = useColorModeValue('#1B2559', '#FFFFFF');
  const donutTotalColor = useColorModeValue('#A3AED0', '#A3AED0');
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

  // The selected window, taken off the end of the 30 days the API returns.
  const shownTrend = revenueTrend.slice(-trendDays);

  const lineChartData = [
    {
      name: 'Revenue',
      data: shownTrend.map((p) => Number(p.revenue.toFixed(2))),
    },
  ];
  // Phase 4 (enterprise-look pass): a raw sparkline asks the seller to read
  // and interpret it themselves. Labelling the peak directly on the chart -
  // "Best day: PKR X on Aug 15" - gives the one-line takeaway without
  // requiring that. Skipped when every point is equal (a flat empty-history
  // line has no "peak" worth calling out) or there's only one point (a peak
  // among one value isn't a finding).
  const revenuePeak =
    shownTrend.length > 1 && new Set(shownTrend.map((p) => p.revenue)).size > 1
      ? shownTrend.reduce((best, p) => (p.revenue > best.revenue ? p : best), shownTrend[0])
      : null;

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
      // Real dates, formatted as "5 Aug" rather than the raw "08-05" slice.
      // tickAmount caps how many labels render so 30 days doesn't produce an
      // unreadable stack of overlapping text - previously every label was
      // emitted and the axis collapsed to nothing.
      categories: shownTrend.map((p) => formatAxisDate(p.date)),
      tickAmount: Math.min(7, Math.max(2, shownTrend.length - 1)),
      labels: {
        show: true,
        rotate: 0,
        hideOverlappingLabels: true,
        style: { colors: '#98A2B3', fontSize: '11px' },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    // A y-axis with no scale made an all-zero series look like a rendering
    // bug rather than "no revenue yet". Labels on, grid lines back.
    yaxis: {
      show: true,
      labels: {
        style: { colors: '#98A2B3', fontSize: '11px' },
        formatter: (v: number) => compactCurrency(v, reportingCurrency),
      },
    },
    grid: { show: true, borderColor: '#F2F4F7', strokeDashArray: 4, xaxis: { lines: { show: false } } },
    colors: ['#465FFF'],
    annotations: revenuePeak
      ? {
          points: [
            {
              x: formatAxisDate(revenuePeak.date),
              y: Number(revenuePeak.revenue.toFixed(2)),
              marker: { size: 5, fillColor: tooltipBg, strokeColor: '#465FFF', strokeWidth: 2 },
              label: {
                borderColor: '#465FFF',
                borderWidth: 0,
                offsetY: -6,
                style: { color: '#FFFFFF', background: '#465FFF', fontSize: '10px', fontWeight: 700, padding: { left: 8, right: 8, top: 4, bottom: 4 } },
                text: `Best day: ${formatCurrency(revenuePeak.revenue, reportingCurrency)}`,
              },
            },
          ],
        }
      : undefined,
    tooltip: {
      custom: ({ series, seriesIndex, dataPointIndex }: { series: number[][]; seriesIndex: number; dataPointIndex: number }) => {
        const point = shownTrend[dataPointIndex];
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
    <div className="font-outfit">
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

      <SectionHeading title="Revenue & fulfillment" />
      <div className="mb-5 @container grid grid-cols-1 gap-4 md:gap-6 @3xl:grid-cols-3">
        <Card
          className="@3xl:col-span-2"
          title={`Revenue trend ${forecast ? '& 14-day forecast' : ''}`}
          action={
            <div className="flex shrink-0 items-center gap-2">
              {forecast && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    forecast.trendDirection === 'up'
                      ? 'bg-success-50 text-success-700 dark:bg-gray-800 dark:text-success-500'
                      : forecast.trendDirection === 'down'
                        ? 'bg-error-50 text-error-700 dark:bg-gray-800 dark:text-error-500'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {forecast.trendDirection === 'flat'
                    ? 'Stable'
                    : `${forecast.trendDirection === 'up' ? '+' : ''}${formatCurrency(forecast.changePerWeek, reportingCurrency)}/wk`}
                </span>
              )}

              {/* Range selector, TailAdmin's segmented-control pattern. Only
                  offered on the plain trend - the forecast series is a fixed
                  60-day fit plus 14 projected days, so slicing it would
                  misrepresent what the model was fitted on. */}
              {!forecast && (
                <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
                  {TREND_RANGES.map((range) => (
                    <button
                      key={range.label}
                      type="button"
                      onClick={() => setTrendDays(range.days)}
                      aria-pressed={trendDays === range.days}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        trendDays === range.days
                          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
        >
          {revenueLoading ? (
            chartSkeleton
          ) : forecast ? (
            <div className="h-[260px]">
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
                  colors: ['#465FFF', '#A3AED0'],
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
            </div>
          ) : shownTrend.length === 0 ? (
            <ChartEmptyState
              message="No revenue data yet - record your first order to see a trend here."
              ctaLabel="Add an order"
              ctaHref={PATH_APPS.orders}
            />
          ) : (
            <div className="h-[260px]">
              <LineChart type="area" chartData={lineChartData} chartOptions={lineChartOptions} />
            </div>
          )}
        </Card>

        <Card title="Order status">
          {ordersLoading ? (
            chartSkeleton
          ) : orders.length === 0 ? (
            <ChartEmptyState
              message="No orders yet - add one to see fulfillment status here."
              ctaLabel="Add an order"
              ctaHref={PATH_APPS.orders}
            />
          ) : (
            <div className="h-[260px]">
              <PieChart type="donut" chartData={orderPieData} chartOptions={orderPieOptions} />
            </div>
          )}
        </Card>
      </div>

      <SectionHeading
        title="Products & inventory"
        meta={
          !statsLoading && (activeProductsStat || lowStockStat) ? (
            <div className="flex items-baseline gap-5">
              {activeProductsStat && (
                <p className="flex items-baseline gap-1.5">
                  <span className="text-base font-semibold text-gray-900 tabular-nums dark:text-white">
                    {activeProductsStat.value}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    active{activeProductsStat.period ? ` (${activeProductsStat.period})` : ''}
                  </span>
                </p>
              )}
              {lowStockStat && (
                <p className="flex items-baseline gap-1.5">
                  {/* Low stock is the one inventory figure that's a warning
                      above zero - everywhere else on this page colour means
                      trend direction; here it means "needs attention". */}
                  <span
                    className={`text-base font-semibold tabular-nums ${
                      Number(lowStockStat.value.replace(/,/g, '')) > 0
                        ? 'text-orange-500'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {lowStockStat.value}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    low stock{lowStockStat.period ? ` (${lowStockStat.period})` : ''}
                  </span>
                </p>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="@container grid grid-cols-1 gap-4 md:gap-6 @3xl:grid-cols-12">
        <Card className="@3xl:col-span-5" title="Category inventory value">
          {categoriesLoading ? (
            chartSkeleton
          ) : categories.length === 0 ? (
            <ChartEmptyState
              message="No active products yet - add one to see category breakdown here."
              ctaLabel="Add a product"
              ctaHref={PATH_APPS.products.root}
            />
          ) : (
            <div className="h-[260px]">
              <PieChart type="donut" chartData={categoryPieData} chartOptions={categoryPieOptions} />
            </div>
          )}
        </Card>

        <Card className="@3xl:col-span-7" title="Top products by inventory value">
          {productsLoading ? (
            chartSkeleton
          ) : topProducts.length === 0 ? (
            <ChartEmptyState
              message="No products yet - add your catalog to rank by inventory value here."
              ctaLabel="Add a product"
              ctaHref={PATH_APPS.products.root}
            />
          ) : (
            <>
              {/* Scrolls within its own container so the page body never
                  scrolls sideways on a narrow viewport. */}
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="pb-3 text-left text-[11px] font-medium uppercase tracking-[0.04em] text-gray-400">
                        Title
                      </th>
                      <th className="pb-3 text-left text-[11px] font-medium uppercase tracking-[0.04em] text-gray-400">
                        Category
                      </th>
                      <th className="pb-3 text-right text-[11px] font-medium uppercase tracking-[0.04em] text-gray-400">
                        Sell price
                      </th>
                      <th className="pb-3 text-right text-[11px] font-medium uppercase tracking-[0.04em] text-gray-400">
                        Stock
                      </th>
                      <th className="pb-3 text-right text-[11px] font-medium uppercase tracking-[0.04em] text-gray-400">
                        Inventory value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                      >
                        <td className="py-3 pr-3 text-sm font-medium text-gray-900 dark:text-white">
                          {p.title}
                        </td>
                        <td className="py-3 pr-3">
                          <span className="whitespace-nowrap rounded-md bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 dark:bg-gray-800 dark:text-brand-400">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-3 text-right text-sm text-gray-600 tabular-nums dark:text-gray-400">
                          {formatCurrency(p.sellPrice, p.currency)}
                        </td>
                        <td className="py-3 text-right text-sm text-gray-600 tabular-nums dark:text-gray-400">
                          {p.stockQty}
                        </td>
                        <td className="py-3 text-right text-sm font-semibold text-gray-900 tabular-nums dark:text-white">
                          {formatCurrency(p.inventoryValue, p.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(productsData?.data?.length ?? 0) > topProducts.length && (
                <div className="mt-3 flex justify-end">
                  <NextLink
                    href={PATH_APPS.products.root}
                    className="text-sm font-medium text-brand-500 transition-colors hover:text-brand-600 dark:text-brand-400"
                  >
                    View all products &rarr;
                  </NextLink>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
