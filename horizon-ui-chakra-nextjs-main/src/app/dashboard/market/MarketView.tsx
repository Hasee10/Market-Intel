'use client';

// Only useColorModeValue remains: the ApexCharts tooltips below are built as
// raw HTML strings, so they need resolved hex values rather than classes.
import { useColorModeValue } from '@chakra-ui/react';
import Link from 'next/link';
import {
  MdOutlineRemoveShoppingCart,
  MdOutlineTrendingDown,
  MdOutlineTrendingUp,
  MdOutlineCheckCircle,
} from 'react-icons/md';

import LineChart from '@/components/charts/LineChart';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Table, THead, TH, TBody, TR, TD, Pill } from '@/components/ui/Table';
import { Pagination, usePagination } from '@/components/ui/Pagination';

import { InsightStrip, type Insight } from '@/components/marketintel/InsightStrip';
import { MarketScopeBanner } from '@/components/marketintel/MarketScopeBanner';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { StatsGrid } from '@/components/marketintel/StatsGrid';
import { UpgradeGate } from '@/components/marketintel/UpgradeGate';
import type { CompetitorPriceAnomaly } from '@/lib/market-intel/anomalies';
import type { DomainBenchmark, DomainPeer } from '@/lib/market-intel/benchmarks';
import type { CategoryPricing } from '@/lib/market-intel/category-pricing';
import type { PriceForecast } from '@/lib/market-intel/forecast';
import type {
  DemandSignal,
  PlatformFreshness,
  PriceTrendPoint,
  StockOutProduct,
} from '@/lib/market-intel/market-insights';
import type { PricingRecommendation } from '@/lib/market-intel/pricing-recommendation';
import type { ProductMatch } from '@/lib/market-intel/product-matching';
import type { MarketScopeSummary } from '@/lib/market-intel/market-definition';
import type { SellerDomain } from '@/lib/market-intel/seller';
import { PATH_DASHBOARD, PATH_ONBOARDING } from '@/lib/paths';
import { coarseRelativeTime } from '@/lib/relative-time';

function formatMetric(metricName: string) {
  return metricName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrencyAs(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

// Axis ticks, not table cells. Neither price chart set a yaxis at all, so
// ApexCharts fell back to its raw default and rendered ticks as
// "2000.0000000000000". Compact notation keeps a 6-figure PKR tick from
// crowding out the plot, and maximumFractionDigits caps the float noise at
// source rather than trimming the string afterwards.
function formatAxisCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

type MarketViewProps = {
  domain: SellerDomain | null;
  scopeSummary: MarketScopeSummary | null;
  reportingCurrency: string;
  benchmarks: DomainBenchmark[];
  peers: DomainPeer[];
  categoryPricing: CategoryPricing | null;
  priceTrend: PriceTrendPoint[];
  stockOuts: StockOutProduct[];
  freshness: PlatformFreshness[];
  demandSignal: DemandSignal | null;
  productMatches: ProductMatch[];
  pricingRecommendations: PricingRecommendation[];
  priceForecast: PriceForecast | null;
  priceAnomalies: CompetitorPriceAnomaly[];
  entitlements: {
    peerBenchmarks: boolean;
    productMatching: boolean;
    pricingRecommendations: boolean;
    forecasting: boolean;
    anomalyDetection: boolean;
  };
};

export default function MarketView({
  domain,
  scopeSummary,
  reportingCurrency,
  benchmarks,
  peers,
  categoryPricing,
  priceTrend,
  stockOuts,
  freshness,
  demandSignal,
  productMatches,
  pricingRecommendations,
  priceForecast,
  priceAnomalies,
  entitlements,
}: MarketViewProps) {
  const sellersInDomain = benchmarks[0]?.sampleSize ?? null;
  // Recommendations ran to 40+ rows and buried every section under them;
  // stock-outs are shorter but the same shape of problem.
  const recPage = usePagination(pricingRecommendations, 10);
  const stockOutPage = usePagination(stockOuts, 8);
  const formatCurrency = (value: number) => formatCurrencyAs(value, reportingCurrency);
  // Same custom-tooltip fix as Overview (app/dashboard/overview/page.tsx) -
  // these two charts had no tooltip styling at all, so they fell through to
  // ApexCharts' unstyled default (a stark white box), inconsistent with the
  // rest of this dark-mode-aware page rather than illegible, but still not
  // "everything visible and consistent." Raw hex because tooltip.custom
  // returns an HTML string, not JSX.
  const tooltipBg = useColorModeValue('#FFFFFF', '#1B254B');
  const tooltipBorder = useColorModeValue('#E2E8F0', 'rgba(255,255,255,0.14)');
  const tooltipTextColor = useColorModeValue('#1B2559', '#FFFFFF');
  const tooltipMuted = useColorModeValue('#707EAE', '#A3AED0');

  // The dash on "Sellers in domain" is not the same statement as the zeros
  // beside it, and flattening it to 0 would be a lie: the count is withheld
  // until three sellers opt in (migration 026's sample-size guard), so it
  // means "not published", where the others mean "none". Each therefore gets
  // a caption saying which it is - the inconsistency read as a bug only
  // because nothing explained it.
  const domainStats = [
    { title: 'Your domain', value: domain?.categoryName ?? 'Not set', icon: 'chart-line', color: 'blue' },
    {
      title: 'Sellers in domain',
      value: sellersInDomain != null ? String(sellersInDomain) : '—',
      period: sellersInDomain == null ? 'Not published until 3 sellers opt in' : undefined,
      icon: 'users',
      color: 'teal',
    },
    {
      title: 'Peers visible to you',
      value: String(peers.length),
      period: peers.length === 0 ? 'No peer has opted in yet' : undefined,
      icon: 'users',
      color: 'violet',
    },
    {
      title: 'Benchmarks tracked',
      value: String(benchmarks.length),
      period: benchmarks.length === 0 ? 'Starts once the domain has enough sellers' : undefined,
      icon: 'chart-line',
      color: 'pink',
    },
  ];

  // Instant-insight strip (same pattern as Overview's InsightBanner, see
  // InsightStrip.tsx) - drawn only from data that isn't behind an
  // UpgradeGate on this page (stockOuts, priceTrend), so a free-tier seller
  // never sees a headline built from a premium finding they can't actually
  // open below. Priority: stock-outs (operational, time-sensitive - a
  // competitor stock-out is demand nobody's filling right now) > a real
  // market price swing (>=3%, avoids calling a rounding blip a trend) >
  // calm fallback. No strip at all when there's no domain set - the
  // dedicated "choose domain" warning below already owns that message,
  // and duplicating it as a neutral insight would just be noise.
  const marketInsight: Insight | null = !domain
    ? null
    : stockOuts.length > 0
      ? {
          tone: 'good',
          icon: MdOutlineRemoveShoppingCart,
          headline: `${stockOuts.length} competitor product${stockOuts.length === 1 ? ' is' : 's are'} out of stock`,
          detail: "That's demand nobody can fill right now - worth checking if you carry it.",
        }
      : (() => {
          if (priceTrend.length < 2) return null;
          const first = priceTrend[0].medianPrice;
          const last = priceTrend[priceTrend.length - 1].medianPrice;
          if (!(first > 0)) return null;
          const pct = ((last - first) / first) * 100;
          if (Math.abs(pct) < 3) return null;
          const up = pct > 0;
          // Rising competitor prices are room for a seller to follow, not a
          // threat - falling prices are the actual margin squeeze.
          return {
            tone: up ? 'good' : 'warning',
            icon: up ? MdOutlineTrendingUp : MdOutlineTrendingDown,
            headline: `Category prices are ${up ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}% over the last 30 days`,
            detail: up
              ? 'The market has room to follow - check your own pricing recommendations below.'
              : 'Competitors are cutting prices - worth reviewing your own margin floor.',
          } satisfies Insight;
        })() ?? {
          tone: 'neutral',
          icon: MdOutlineCheckCircle,
          headline: 'No unusual market movement to flag right now',
          detail: 'Category pricing and competitor stock are tracking normally.',
        };

  return (
    <div className="font-outfit">
      <PageHeader
        title="Market"
        actionButton={
          <div className="flex gap-2">
            <Link
              href={PATH_DASHBOARD.competitors}
              className="rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              Competitors
            </Link>
            <Link
              href={PATH_DASHBOARD.marketDefinition}
              className="rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300"
            >
              Market definition
            </Link>
          </div>
        }
      />

      {/* ROADMAP.md C2. Everything below this line is computed against the
          scope this strip describes, so it goes first - a median with no
          stated definition is a number the seller has to take on trust. */}
      {scopeSummary && <MarketScopeBanner summary={scopeSummary} />}

      {marketInsight && <InsightStrip insight={marketInsight} />}

      {freshness.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {freshness.map((f) => (
            <span
              key={f.platformName}
              className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              {f.platformName}: scraped {coarseRelativeTime(f.lastScrapedAt)}
            </span>
          ))}
        </div>
      )}

      {!domain && (
        <Alert status="warning" className="mb-5">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span>You haven&apos;t set a domain yet, so we can&apos;t show you peer benchmarks.</span>
            <Link
              href={PATH_ONBOARDING}
              className="shrink-0 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              Choose domain
            </Link>
          </div>
        </Alert>
      )}

      <StatsGrid data={domainStats} columns={4} />

      <UpgradeGate hasAccess={entitlements.peerBenchmarks} requiredPlanLabel="Premium" featureName="Domain benchmarks">
        <Card className="mb-5" title="Domain benchmarks">
          {/* Benchmarks stay empty until MIN_SAMPLE_SIZE (3) sellers in this
              category have opted in - see benchmarks-job.ts. That's a real
              anonymity floor, not a bug, but an unexplained blank table reads
              as broken software, so say why rather than showing an empty
              grid. */}
          {benchmarks.length === 0 ? (
            <Alert status="info" title="Not enough sellers in your domain yet">
              Peer benchmarks need at least 3 opted-in sellers in a category before we publish them,
              so no single seller&apos;s numbers can be reverse-engineered from the aggregate.
              We&apos;ll turn this on for your domain automatically once it reaches that threshold —
              nothing for you to do. Everything else on this page is drawn from scraped market data
              and works today.
            </Alert>
          ) : (
            <Table minWidth={520}>
              <THead>
                <TH>Metric</TH>
                <TH numeric>P25</TH>
                <TH numeric>Median</TH>
                <TH numeric>P75</TH>
                <TH numeric>Sample size</TH>
              </THead>
              <TBody>
                {benchmarks.map((row) => (
                  <TR key={row.metricName}>
                    <TD strong>{formatMetric(row.metricName)}</TD>
                    <TD numeric>{row.p25 ?? '—'}</TD>
                    <TD numeric>{row.median ?? '—'}</TD>
                    <TD numeric>{row.p75 ?? '—'}</TD>
                    <TD numeric>{row.sampleSize}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </UpgradeGate>

      <Card
        className="mb-5"
        title="Category pricing (market-wide)"
        action={
          domain && !categoryPricing ? (
            <Pill>No market pricing data for this category yet</Pill>
          ) : undefined
        }
      >
        {categoryPricing ? (
          <>
            <Table minWidth={640}>
              <THead>
                <TH numeric>Min</TH>
                <TH numeric>P25</TH>
                <TH numeric>Median</TH>
                <TH numeric>P75</TH>
                <TH numeric>Max</TH>
                <TH numeric>Average</TH>
                <TH numeric>Listings tracked</TH>
              </THead>
              <TBody>
                <TR>
                  <TD numeric>{formatCurrency(categoryPricing.minPrice)}</TD>
                  {/* p25/p75 are null below migration 026's sample-size threshold inside
                      market_scope_price_stats - showing "-" here instead of coercing
                      through formatCurrency(null), which Intl.NumberFormat would
                      silently render as a misleading "Rs 0". */}
                  <TD numeric>
                    {categoryPricing.p25 != null ? formatCurrency(categoryPricing.p25) : '—'}
                  </TD>
                  <TD numeric strong>
                    {formatCurrency(categoryPricing.median)}
                  </TD>
                  <TD numeric>
                    {categoryPricing.p75 != null ? formatCurrency(categoryPricing.p75) : '—'}
                  </TD>
                  <TD numeric>{formatCurrency(categoryPricing.maxPrice)}</TD>
                  <TD numeric>{formatCurrency(categoryPricing.avgPrice)}</TD>
                  <TD numeric>{categoryPricing.count}</TD>
                </TR>
              </TBody>
            </Table>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Scraped from {categoryPricing.samplePlatforms.join(', ')} - refreshed automatically
              every 2 days.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            We haven&apos;t scraped competitor pricing for this category yet. Coverage is expanding
            source by source.
          </p>
        )}
      </Card>

      {/* Two columns only when there is actually a demand signal to put in
          the second one. OLX is a disabled scraper path, so for most sellers
          that card is permanently empty and was holding a third of the row to
          say "no data yet". */}
      <div
        className={`mb-5 @container grid grid-cols-1 gap-4 md:gap-6 ${
          demandSignal ? '@3xl:grid-cols-3' : ''
        }`}
      >
        <Card
          className={demandSignal ? '@3xl:col-span-2' : undefined}
          title={`Price trend ${priceForecast ? '& 14-day forecast' : '(30 days)'}`}
          action={
            priceForecast ? (
              // Colour is inverted vs Overview on purpose: rising *competitor*
              // prices are room for this seller to follow, falling ones are the
              // margin squeeze. Up is not automatically good here.
              <Pill
                tone={
                  priceForecast.trendDirection === 'up'
                    ? 'error'
                    : priceForecast.trendDirection === 'down'
                      ? 'success'
                      : 'neutral'
                }
              >
                {priceForecast.trendDirection === 'flat'
                  ? 'Stable'
                  : `${priceForecast.trendDirection === 'up' ? '+' : ''}${formatCurrency(priceForecast.changePerWeek)}/wk`}
              </Pill>
            ) : undefined
          }
        >
          {priceForecast ? (
            <div className="h-[260px]">
              <LineChart
                chartData={[
                  {
                    name: 'Median price',
                    data: priceForecast.points.map((p) => (p.isProjected ? null : p.value)),
                  },
                  {
                    name: 'Forecast',
                    data: priceForecast.points.map((p, i) =>
                      p.isProjected || i === priceForecast.points.findIndex((x) => x.isProjected) - 1
                        ? p.value
                        : null,
                    ),
                  },
                ]}
                chartOptions={{
                  chart: { toolbar: { show: false } },
                  xaxis: {
                    categories: priceForecast.points.map((p) => p.date.slice(5)),
                    labels: { style: { colors: tooltipMuted, fontSize: '10px' } },
                  },
                  yaxis: {
                    labels: {
                      style: { colors: tooltipMuted, fontSize: '10px' },
                      formatter: (value: number) => formatAxisCurrency(value, reportingCurrency),
                    },
                  },
                  dataLabels: { enabled: false },
                  stroke: { curve: 'smooth', width: [3, 3], dashArray: [0, 6] },
                  colors: ['#465FFF', '#A3AED0'],
                  tooltip: {
                    custom: ({ series, dataPointIndex }: { series: number[][]; dataPointIndex: number }) => {
                      const point = priceForecast.points[dataPointIndex];
                      const isProjected = point?.isProjected;
                      const value = isProjected ? series[1]?.[dataPointIndex] : series[0]?.[dataPointIndex];
                      return `<div style="background:${tooltipBg};border:1px solid ${tooltipBorder};border-radius:10px;padding:8px 12px;box-shadow:0 4px 16px rgba(17,28,78,0.16);font-family:inherit;">
                        <div style="color:${tooltipMuted};font-size:11px;margin-bottom:2px;">${point?.date ?? ''}${isProjected ? ' (projected)' : ''}</div>
                        <div style="color:${tooltipTextColor};font-size:13px;font-weight:700;">${formatCurrency(value ?? 0)}</div>
                      </div>`;
                    },
                  },
                }}
              />
            </div>
          ) : priceTrend.length > 1 ? (
            <div className="h-[260px]">
              <LineChart
                chartData={[
                  {
                    name: 'Median price',
                    data: priceTrend.map((p) => p.medianPrice),
                  },
                ]}
                chartOptions={{
                  chart: { toolbar: { show: false } },
                  xaxis: {
                    categories: priceTrend.map((p) => p.date.slice(5)),
                    labels: { style: { colors: tooltipMuted, fontSize: '10px' } },
                  },
                  yaxis: {
                    labels: {
                      style: { colors: tooltipMuted, fontSize: '10px' },
                      formatter: (value: number) => formatAxisCurrency(value, reportingCurrency),
                    },
                  },
                  dataLabels: { enabled: false },
                  stroke: { curve: 'smooth', width: 3 },
                  colors: ['#465FFF'],
                  tooltip: {
                    custom: ({ series, seriesIndex, dataPointIndex }: { series: number[][]; seriesIndex: number; dataPointIndex: number }) => {
                      const point = priceTrend[dataPointIndex];
                      const value = series[seriesIndex]?.[dataPointIndex] ?? 0;
                      return `<div style="background:${tooltipBg};border:1px solid ${tooltipBorder};border-radius:10px;padding:8px 12px;box-shadow:0 4px 16px rgba(17,28,78,0.16);font-family:inherit;">
                        <div style="color:${tooltipMuted};font-size:11px;margin-bottom:2px;">${point?.date ?? ''}</div>
                        <div style="color:${tooltipTextColor};font-size:13px;font-weight:700;">${formatCurrency(value)}</div>
                      </div>`;
                    },
                  },
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Not enough price history yet to chart a trend for this category.
            </p>
          )}
        </Card>

        {demandSignal && (
        <Card title="Demand signal (OLX)">
          <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">Active listings</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums dark:text-white">
                {demandSignal.activeListings}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {demandSignal.newListingsLast7Days} new in the last 7 days
                {demandSignal.newListingsPrior7Days > 0 &&
                  ` (vs ${demandSignal.newListingsPrior7Days} the week before)`}
              </p>
          </div>
        </Card>
        )}
      </div>

      <Card className="mb-5" title="Competitor stock-outs">
        {stockOuts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No tracked competitor is currently showing out of stock in your category.
          </p>
        ) : (
          <Table minWidth={520}>
            <THead>
              <TH>Product</TH>
              <TH>Platform</TH>
              <TH numeric>Last price</TH>
            </THead>
            <TBody>
              {stockOutPage.visible.map((product) => (
                <TR key={product.id}>
                  <TD strong>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-brand-500 hover:underline"
                    >
                      {product.title}
                    </a>
                  </TD>
                  <TD>{product.platformName ?? '—'}</TD>
                  <TD numeric>{product.price != null ? formatCurrency(product.price) : '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination
          page={stockOutPage.page}
          pageCount={stockOutPage.pageCount}
          onPageChange={stockOutPage.setPage}
          rangeStart={stockOutPage.rangeStart}
          rangeEnd={stockOutPage.rangeEnd}
          total={stockOutPage.total}
          label="stock-outs"
        />
      </Card>

      <UpgradeGate
        hasAccess={entitlements.productMatching}
        requiredPlanLabel="Paid"
        featureName="Closest competitor match per product"
      >
        <Card
          className="mb-5"
          title="Closest competitor match per product"
          action={<Pill>Title-similarity match, MVP</Pill>}
        >
          {productMatches.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No confident matches found yet between your active products and scraped competitor
              listings in this category.
            </p>
          ) : (
            <Table minWidth={720}>
              <THead>
                <TH>Your product</TH>
                <TH numeric>Your price</TH>
                <TH>Closest match</TH>
                <TH numeric>Their price</TH>
                <TH numeric>Confidence</TH>
              </THead>
              <TBody>
                {productMatches.map((match) => (
                  <TR key={match.sellerProductId}>
                    <TD strong>{match.sellerProductTitle}</TD>
                    <TD numeric>
                      {match.sellerPrice != null ? formatCurrency(match.sellerPrice) : '—'}
                    </TD>
                    <TD>
                      <a
                        href={match.matchedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-brand-500 hover:underline"
                      >
                        {match.matchedTitle}
                      </a>{' '}
                      {match.matchedPlatformName && `(${match.matchedPlatformName})`}
                    </TD>
                    <TD numeric>
                      {match.matchedPrice != null ? formatCurrency(match.matchedPrice) : '—'}
                    </TD>
                    <TD numeric>{Math.round(match.confidence * 100)}%</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </UpgradeGate>

      <UpgradeGate
        hasAccess={entitlements.pricingRecommendations}
        requiredPlanLabel="Paid"
        featureName="Pricing recommendations"
      >
        <Card
          className="mb-5"
          title="Pricing recommendations"
          action={<Pill>Rule-based: competitor band + your margin floor</Pill>}
        >
          {pricingRecommendations.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Set both cost price and sell price on your active products to get pricing
              recommendations here.
            </p>
          ) : (
            <Table minWidth={760}>
              <THead>
                <TH>Product</TH>
                <TH numeric>Current price</TH>
                <TH numeric>Recommended</TH>
                <TH>Direction</TH>
                <TH>Why</TH>
              </THead>
              <TBody>
                {recPage.visible.map((rec) => (
                  <TR key={rec.productId}>
                    <TD strong>
                      {rec.productTitle}
                      {/* Each row is judged against its own category's band,
                          not the market on screen, so the catalogue can span
                          categories. Naming the band here is what makes a bed
                          appearing under a beauty market read as deliberate
                          rather than as a bug. */}
                      {rec.categorySlug !== domain?.categorySlug && (
                        <span className="mt-0.5 block text-xs font-normal text-gray-400 dark:text-gray-500">
                          {formatMetric(rec.categorySlug.replace(/-/g, ' '))} band
                        </span>
                      )}
                      {/* Duplicates are collapsed to one row so the advice
                          can't contradict itself, but the seller still needs
                          to know the rows exist - this layer can only paper
                          over them, not fix them. */}
                      {rec.duplicateEntries > 1 && (
                        <span className="mt-0.5 block text-xs font-normal text-orange-700 dark:text-orange-500">
                          {rec.duplicateEntries} duplicate catalogue entries - priced off the highest
                          cost
                        </span>
                      )}
                    </TD>
                    <TD numeric>{formatCurrency(rec.currentPrice)}</TD>
                    <TD numeric strong>
                      {formatCurrency(rec.recommendedPrice)}
                    </TD>
                    <TD>
                      <span className="flex flex-wrap items-center gap-1">
                        <Pill
                          tone={
                            rec.direction === 'increase'
                              ? 'success'
                              : rec.direction === 'decrease'
                                ? 'error'
                                : 'neutral'
                          }
                        >
                          {rec.direction}
                        </Pill>
                        {rec.marginConstrained && <Pill tone="warning">margin-constrained</Pill>}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {rec.rationale}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          <Pagination
            page={recPage.page}
            pageCount={recPage.pageCount}
            onPageChange={recPage.setPage}
            rangeStart={recPage.rangeStart}
            rangeEnd={recPage.rangeEnd}
            total={recPage.total}
            label="products"
          />
        </Card>
      </UpgradeGate>

      <UpgradeGate
        hasAccess={entitlements.anomalyDetection}
        requiredPlanLabel="Premium"
        featureName="Competitor price anomalies"
      >
        <Card
          className="mb-5"
          title="Competitor price anomalies"
          action={<Pill>IQR outliers, last 7 days</Pill>}
        >
          {priceAnomalies.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No unusual competitor price moves detected in the last 7 days.
            </p>
          ) : (
            <Table minWidth={680}>
              <THead>
                <TH>Product</TH>
                <TH>Platform</TH>
                <TH numeric>Was</TH>
                <TH numeric>Now</TH>
                <TH numeric>Change</TH>
              </THead>
              <TBody>
                {priceAnomalies.map((a) => (
                  <TR key={a.productId}>
                    <TD strong>{a.title}</TD>
                    <TD>{a.platformName ?? '—'}</TD>
                    <TD numeric>{formatCurrency(a.oldPrice)}</TD>
                    <TD numeric>{formatCurrency(a.newPrice)}</TD>
                    <TD numeric>
                      {/* A competitor raising prices is the opportunity here,
                          so up is red only in the sense of "they moved" - kept
                          identical to the previous behaviour rather than
                          re-deciding the semantics mid-migration. */}
                      <Pill tone={a.pctChange > 0 ? 'error' : 'success'}>
                        {a.pctChange > 0 ? '+' : ''}
                        {a.pctChange}%
                      </Pill>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </UpgradeGate>

      <UpgradeGate hasAccess={entitlements.peerBenchmarks} requiredPlanLabel="Premium" featureName="Peers in your domain">
        <Card
          className="mb-5"
          title="Peers in your domain"
        >
          {/* Four column headings over nothing is not an empty state, it is a
              table that looks broken - and the Pill that used to carry this
              sentence sat in the header, away from the space it was
              explaining. One line, where the rows would have been. */}
          {peers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No peers have opted in to be visible yet. Sellers choose this for themselves, so this
              fills in as more of your domain opts in - there is nothing for you to do.
            </p>
          ) : (
            <Table minWidth={640}>
              <THead>
                <TH>Seller</TH>
                <TH>Shares rating</TH>
                <TH>Shares price positioning</TH>
                <TH>Shares category rank</TH>
              </THead>
              <TBody>
                {peers.map((peer) => (
                  <TR key={peer.sellerId}>
                    <TD strong>{peer.displayName ?? 'Anonymous seller'}</TD>
                    <TD>{peer.showRating ? 'Yes' : 'No'}</TD>
                    <TD>{peer.showPricePosition ? 'Yes' : 'No'}</TD>
                    <TD>{peer.showCategoryRank ? 'Yes' : 'No'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </UpgradeGate>

      {/* One card, not three places saying the same thing. This absorbed the
          permanent "Peer benchmarking, not surveillance" banner that used to
          sit above the fold on every visit, and the separate opt-in card next
          to it - all three were static copy that never changed. */}
      <Card title="Where this data comes from">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Benchmarks are computed from anonymized, aggregated seller data in your domain - never a
          direct feed of another seller&apos;s private orders, customers, or churn. You only ever
          see aggregate or seller-opted-in fields (rating, price positioning, response time);
          nothing private about a competitor&apos;s business is shown.
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          To choose which of your own stats peers can see, go to Settings &rarr; Public profile.
        </p>
      </Card>
    </div>
  );
}
