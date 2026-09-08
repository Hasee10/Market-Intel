'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useColorModeValue } from '@chakra-ui/react';
import { MdAddCircleOutline, MdOutlineInsertChart } from 'react-icons/md';

import PieChart from 'components/charts/PieChart';
import LineChart from 'components/charts/LineChart';
import BarChart from 'components/charts/BarChart';

import { DownloadReportButton } from '@/components/marketintel/DownloadReportButton';
import { InsightBanner } from '@/components/marketintel/InsightBanner';
import { OnboardingChecklist } from '@/components/marketintel/OnboardingChecklist';
import type { OnboardingStatus } from '@/lib/market-intel/seller/onboarding-status';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { Table, THead, TH, TBody, TR, TD, Pill } from '@/components/ui/Table';
import { ProductThumb } from '@/components/ui/ProductThumb';
import { PATH_APPS } from '@/lib/paths';
import type {
  CategoryRow,
  EcommerceStat,
  OrderStatusRow,
  RevenuePoint,
  TopProductRow,
} from '@/lib/market-intel/seller/overview';
import type { OrderAnomaly } from '@/lib/market-intel/market/anomalies';
import type { RevenueForecast } from '@/lib/market-intel/market/forecast';

// Pure rendering - all seven data sets arrive as props, already fetched
// server-side in one request by page.tsx. This used to fetch all of it
// itself via seven useFetch() calls; see page.tsx's header comment for why
// that made Overview the slowest page in the app. Nothing about how any of
// this data is CALCULATED changed - dedup, palette, chart options, empty
// states are all copied over unchanged - only where the fetching happens.
type OverviewViewProps = {
  stats: EcommerceStat[];
  products: TopProductRow[];
  orders: OrderStatusRow[];
  categories: CategoryRow[];
  revenueTrend: RevenuePoint[];
  anomalies: OrderAnomaly[];
  forecast: RevenueForecast | null;
  reportingCurrency: string;
  onboardingStatus: OnboardingStatus | null;
};

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

// Chart palette anchored on TailAdmin's brand-500 (#465FFF) so the charts
// match the rest of the dashboard - ApexCharts takes raw hex, not tokens.
//
// These are not chosen by eye. The previous set failed an accessibility
// check twice over: #6AD2FF and #FFB547 sat outside the usable lightness
// band, and #6AD2FF/#05CD99/#FFB547 all fell below 3:1 against the light
// card surface, so three of eight series were washed out for anyone with
// low vision. Each slot here is snapped to a darker step of the same hue and
// verified against the lightness band, chroma floor, colour-vision-deficiency
// separation, normal-vision separation and surface contrast.
//
// The ORDER is load-bearing, not decorative. Amber next to green or red is
// the classic deutan/protan collision - adjacent-pair separation dropped to
// ΔE 3.9 in that arrangement. Interleaving purple and cyan between them
// lifts the worst adjacent pair to ΔE 21.9. Reordering these hues silently
// re-breaks the check.
const PALETTE_LIGHT = ['#465FFF', '#039855', '#7F56D9', '#D6A100', '#0BA5EC', '#D92D20'];
// Dark mode is a separate set, not an automatic flip: two slots that pass
// against a white card are too light against the dark one.
const PALETTE_DARK = ['#465FFF', '#039855', '#7F56D9', '#B98A00', '#0989BE', '#D92D20'];

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

export default function OverviewView({
  stats,
  products,
  orders,
  categories,
  revenueTrend,
  anomalies,
  forecast,
  reportingCurrency,
  onboardingStatus,
}: OverviewViewProps) {
  const [trendDays, setTrendDays] = useState<number>(30);
  // Only the values ApexCharts still needs survive here. Card borders, table
  // row hover, the section accent bar and the category badge all moved to
  // Tailwind classes in the markup below, so their useColorModeValue calls
  // were removed rather than left dangling.
  const PALETTE = useColorModeValue(PALETTE_LIGHT, PALETTE_DARK);
  // Grey for the "Other" aggregate bar - theme-aware for the same reason the
  // palette is: one value cannot sit legibly on both card backgrounds.
  const OTHER_BAR_COLOR = useColorModeValue('#98A2B3', '#667085');
  const donutLabelColor = useColorModeValue('#1B2559', '#FFFFFF');
  const donutTotalColor = useColorModeValue('#A3AED0', '#A3AED0');
  // Recessive hairline, one shade off the surface, in both modes.
  const gridColor = useColorModeValue('#F2F4F7', 'rgba(255,255,255,0.08)');
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

  const dedupedProducts = (() => {
    const seen = new Map<string, TopProductRow>();
    for (const row of products) {
      const key = `${row.category}::${row.title.trim().toLowerCase().replace(/\s+/g, ' ')}`;
      const existing = seen.get(key);
      // Keep the larger holding: two rows for one product are one product,
      // and the bigger position is the one worth ranking on.
      if (!existing || row.inventoryValue > existing.inventoryValue) seen.set(key, row);
    }
    return [...seen.values()].sort((a, b) => b.inventoryValue - a.inventoryValue);
  })();
  const topProducts = dedupedProducts.slice(0, 5);
  const recentAnomaly = anomalies[0];

  const SECONDARY_STAT_TITLES = new Set(['Active Products', 'Low Stock Products']);
  const primaryStats = stats.filter((s) => !SECONDARY_STAT_TITLES.has(s.title));
  const activeProductsStat = stats.find((s) => s.title === 'Active Products');
  const lowStockStat = stats.find((s) => s.title === 'Low Stock Products');

  // The selected window, taken off the end of the 30 days the API returns.
  const shownTrend = revenueTrend.slice(-trendDays);
  // A flat line pinned to zero reads as a rendering fault, not as "no
  // revenue yet" - and the y-axis collapses to a single tick, so there is
  // nothing to read either. Treated as empty so the existing empty state,
  // which says the useful thing and offers the next action, actually fires.
  const hasAnyRevenue = shownTrend.some((p) => p.revenue > 0);

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
    grid: { show: true, borderColor: gridColor, strokeDashArray: 0, xaxis: { lines: { show: false } } },
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
      ? [...topCategories, { category: 'Other', value: otherCategoriesValue, products: 0, percentage: 0, color: 'gray' }]
      : topCategories;

  const categoryPieData = chartCategories.map((c) => c.value);
  const totalCategoryValue = categoryPieData.reduce((sum, v) => sum + v, 0);

  // Horizontal bars, not a donut.
  //
  // One category held ~80% of inventory value and the rest were slivers -
  // a form that shows part-to-whole at a glance but makes the small
  // categories impossible to compare with each other, which is the actual
  // question ("where is my money after the obvious one?"). Bars share a
  // common baseline, so a 2% category and a 3% category are visibly
  // different; the total moves to a caption, where it was the only thing
  // the donut's hole was really carrying.
  //
  // One colour for every bar, not one per category: length already encodes
  // the value, so a per-bar hue would spend the palette re-stating it. Value
  // labels sit at the end of each bar - required rather than decorative,
  // since the validated palette carries a contrast WARN that is only
  // dischargeable with visible labels or a table view.
  const categoryBarOptions = {
    chart: { toolbar: { show: false } },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        borderRadiusApplication: 'end' as const,
        barHeight: '62%',
        // `distributed` so the Other bucket can be tinted differently below.
        distributed: true,
        // THE FIX. Without an explicit position ApexCharts draws horizontal
        // bar labels INSIDE the bar, and textAnchor/offsetX then anchor from
        // there - which is fine on the one long bar and unreadable on every
        // short one, where the label starts inside a sliver and its leading
        // characters are swallowed by the fill ("PKR 1.1M" rendering as
        // "R 1.1M"). For a horizontal bar, position 'top' means the end of
        // the bar, so with textAnchor 'start' the label sits just past it,
        // on the card background, at full contrast regardless of bar length.
        dataLabels: { position: 'top' as const },
      },
    },
    // One colour for the real categories - length already encodes value, so
    // a hue per category would only re-state it. Other is the exception and
    // the difference is semantic, not decorative: it is an aggregate of the
    // remaining categories, not a category, and it can legitimately outrank
    // named bars below it (1.9M against 723K here). Tinting it grey is what
    // stops that reading as a chart sorted wrongly.
    colors: chartCategories.map((c) => (c.category === 'Other' ? OTHER_BAR_COLOR : PALETTE[0])),
    dataLabels: {
      enabled: true,
      textAnchor: 'start' as const,
      offsetX: 8,
      formatter: (v: number) => compactCurrency(Number(v), reportingCurrency),
      // Full text colour, not the muted axis grey: these labels now sit on
      // the card background rather than on the fill, and they are the only
      // place an exact value is readable without hovering - the comment
      // above about the palette's contrast WARN depends on them being legible.
      style: { fontSize: '11px', fontWeight: 600, colors: [tooltipText] },
    },
    xaxis: {
      categories: chartCategories.map((c) => c.category),
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: tooltipMuted, fontSize: '11px' } } },
    // The longest bar spans the full plot width and its label now sits
    // outside the end of it, so the plot has to give that label room -
    // 48 was sized for labels drawn inside the bar.
    grid: { show: false, padding: { right: 96 } },
    legend: { show: false },
    tooltip: {
      custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
        const row = chartCategories[dataPointIndex];
        if (!row) return '';
        const pct = totalCategoryValue > 0 ? (row.value / totalCategoryValue) * 100 : 0;
        return `<div style="background:${tooltipBg};border:1px solid ${tooltipBorder};border-radius:10px;padding:8px 12px;box-shadow:0 4px 16px rgba(17,28,78,0.16);font-family:inherit;">
          <div style="color:${tooltipMuted};font-size:11px;margin-bottom:2px;">${row.category}</div>
          <div style="color:${tooltipText};font-size:13px;font-weight:700;">${formatCurrency(row.value, reportingCurrency)}</div>
          <div style="color:${tooltipMuted};font-size:11px;margin-top:2px;">${pct.toFixed(1)}% of inventory value</div>
        </div>`;
      },
    },
  };

  return (
    <div className="font-outfit">
      <PageHeader title="Overview" actionButton={<DownloadReportButton />} />

      <OnboardingChecklist status={onboardingStatus} />

      <InsightBanner stats={stats} anomaly={recentAnomaly} forecast={forecast} currency={reportingCurrency} />

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
      <StatsGrid data={primaryStats} columns={4} />

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
          {forecast ? (
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
          ) : shownTrend.length === 0 || !hasAnyRevenue ? (
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
          {orders.length === 0 ? (
            <ChartEmptyState
              message="No orders yet - add one to see fulfillment status here."
              ctaLabel="Add an order"
              ctaHref={PATH_APPS.orders}
            />
          ) : orders.length <= 2 ? (
            /* A two-slice donut is a pie chart answering a question with two
               numbers in it - the ring adds nothing the counts don't already
               say, and here it also contradicted the "Orders (30d)" tile
               beside it by showing an all-time total in its hole. A
               proportion bar plus the actual counts says the same thing
               without either problem. The 2px gaps between segments are the
               separator; a border around each would be heavier and is the
               wrong tool. */
            <div className="flex h-[260px] flex-col justify-center gap-5 px-1">
              <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
                {orders.map((o, i) => (
                  <span
                    key={o.status}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{
                      width: `${totalOrderCount > 0 ? (o.count / totalOrderCount) * 100 : 0}%`,
                      backgroundColor: PALETTE[i % PALETTE.length],
                    }}
                  />
                ))}
              </div>

              <ul className="list-none space-y-3">
                {orders.map((o, i) => (
                  <li key={o.status} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm text-gray-600 capitalize dark:text-gray-300">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                      />
                      {o.status}
                    </span>
                    <span className="text-sm font-bold text-gray-800 tabular-nums dark:text-white">
                      {o.count}
                      <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">
                        {totalOrderCount > 0 ? Math.round((o.count / totalOrderCount) * 100) : 0}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              <p className="text-xs text-gray-400 dark:text-gray-500">
                {totalOrderCount} order{totalOrderCount === 1 ? '' : 's'} in total
              </p>
            </div>
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
          activeProductsStat || lowStockStat ? (
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
          {categories.length === 0 ? (
            <ChartEmptyState
              message="No active products yet - add one to see category breakdown here."
              ctaLabel="Add a product"
              ctaHref={PATH_APPS.products.root}
            />
          ) : (
            <>
              <div className="h-[260px]">
                <BarChart chartData={[{ name: 'Inventory value', data: categoryPieData }]} chartOptions={categoryBarOptions} />
              </div>
              {/* The total was the only thing the donut's hole carried; as a
                  caption it stays readable without costing the chart a form
                  that hides its own small categories. */}
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Total inventory value{' '}
                <span className="font-semibold text-gray-800 dark:text-white">
                  {formatCurrency(totalCategoryValue, reportingCurrency)}
                </span>{' '}
                across {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
              </p>
            </>
          )}
        </Card>

        <Card className="@3xl:col-span-7" title="Top products by inventory value">
          {topProducts.length === 0 ? (
            <ChartEmptyState
              message="No products yet - add your catalog to rank by inventory value here."
              ctaLabel="Add a product"
              ctaHref={PATH_APPS.products.root}
            />
          ) : (
            <>
              {/* The shared Table primitives, not a hand-rolled <table>:
                  this was the last table in the dashboard still carrying its
                  own header/border/hover classes, which is how it drifted
                  from the ones on Market, Competitors and Watchlist. Table
                  also owns the horizontal-scroll container. */}
              <Table minWidth={620}>
                <THead>
                  <TH>Product</TH>
                  <TH>Category</TH>
                  <TH numeric>Sell price</TH>
                  <TH numeric>Stock</TH>
                  <TH numeric>Inventory value</TH>
                </THead>
                <TBody>
                  {topProducts.map((p) => (
                    <TR key={p.id}>
                      <TD strong>
                        <span className="flex items-center gap-3">
                          <ProductThumb src={p.imageUrl} alt="" categoryName={p.category} />
                          <span className="min-w-0">{p.title}</span>
                        </span>
                      </TD>
                      <TD>
                        <Pill tone="brand">{p.category}</Pill>
                      </TD>
                      <TD numeric>{formatCurrency(p.sellPrice, p.currency)}</TD>
                      <TD numeric>{p.stockQty.toLocaleString()}</TD>
                      <TD numeric strong>
                        {formatCurrency(p.inventoryValue, p.currency)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {dedupedProducts.length > topProducts.length && (
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
