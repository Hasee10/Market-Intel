'use client';

// Chakra still used by the not-yet-ported lower half of this page (the
// paid/premium tables and the explainer cards). Removed as those blocks
// convert.
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Table as ChakraTable,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
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

function formatRelativeTime(iso: string) {
  const hours = Math.round((Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000));
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
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
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const sellersInDomain = benchmarks[0]?.sampleSize ?? null;
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

  const domainStats = [
    { title: 'Your domain', value: domain?.categoryName ?? 'Not set', icon: 'chart-line', color: 'blue' },
    { title: 'Sellers in domain', value: sellersInDomain != null ? String(sellersInDomain) : '—', icon: 'users', color: 'teal' },
    { title: 'Peers visible to you', value: String(peers.length), icon: 'users', color: 'violet' },
    { title: 'Benchmarks tracked', value: String(benchmarks.length), icon: 'chart-line', color: 'pink' },
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
              {f.platformName}: scraped {formatRelativeTime(f.lastScrapedAt)}
            </span>
          ))}
        </div>
      )}

      <Alert status="info" title="Peer benchmarking, not surveillance" className="mb-5">
        You only see aggregate or seller-opted-in fields for other sellers in your domain (e.g.
        rating, price positioning, response time). Nothing private about a competitor&apos;s
        business is ever shown.
      </Alert>

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

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap="20px" mb="20px">
        <Card>
          <Flex justify="space-between" align="center" mb="12px">
            <Text fontSize="lg" fontWeight="600" color={textColor}>
              Price trend {priceForecast ? '& 14-day forecast' : '(30 days)'}
            </Text>
            {priceForecast && (
              <Badge colorScheme={priceForecast.trendDirection === 'up' ? 'red' : priceForecast.trendDirection === 'down' ? 'green' : 'gray'}>
                {priceForecast.trendDirection === 'flat'
                  ? 'Stable'
                  : `${priceForecast.trendDirection === 'up' ? '+' : ''}${formatCurrency(priceForecast.changePerWeek)}/wk`}
              </Badge>
            )}
          </Flex>
          {priceForecast ? (
            <Box h="260px">
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
                  dataLabels: { enabled: false },
                  stroke: { curve: 'smooth', width: [3, 3], dashArray: [0, 6] },
                  colors: ['#4318FF', '#A3AED0'],
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
            </Box>
          ) : priceTrend.length > 1 ? (
            <Box h="260px">
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
                  dataLabels: { enabled: false },
                  stroke: { curve: 'smooth', width: 3 },
                  colors: ['#4318FF'],
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
            </Box>
          ) : (
            <Text fontSize="sm" color="secondaryGray.600">
              Not enough price history yet to chart a trend for this category.
            </Text>
          )}
        </Card>

        <Card>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="12px">
            Demand signal (OLX)
          </Text>
          {demandSignal ? (
            <Flex direction="column" gap="8px">
              <Text fontSize="sm" color="secondaryGray.600">
                Active listings
              </Text>
              <Text fontSize="2xl" fontWeight="700" color={textColor}>
                {demandSignal.activeListings}
              </Text>
              <Text fontSize="sm" color="secondaryGray.600">
                {demandSignal.newListingsLast7Days} new in the last 7 days
                {demandSignal.newListingsPrior7Days > 0 &&
                  ` (vs ${demandSignal.newListingsPrior7Days} the week before)`}
              </Text>
            </Flex>
          ) : (
            <Text fontSize="sm" color="secondaryGray.600">
              No OLX classifieds data for this category yet.
            </Text>
          )}
        </Card>
      </Grid>

      <Card className="mb-5">
        <Text fontSize="lg" fontWeight="600" color={textColor} mb="12px">
          Competitor stock-outs
        </Text>
        {stockOuts.length === 0 ? (
          <Text fontSize="sm" color="secondaryGray.600">
            No tracked competitor is currently showing out of stock in your category.
          </Text>
        ) : (
          <Box overflowX="auto">
            <ChakraTable variant="simple">
              <Thead>
                <Tr>
                  <Th>Product</Th>
                  <Th>Platform</Th>
                  <Th>Last price</Th>
                </Tr>
              </Thead>
              <Tbody>
                {stockOuts.map((product) => (
                  <Tr key={product.id}>
                    <Td>
                      <a href={product.url} target="_blank" rel="noreferrer">
                        {product.title}
                      </a>
                    </Td>
                    <Td>{product.platformName ?? '—'}</Td>
                    <Td>{product.price != null ? formatCurrency(product.price) : '—'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </ChakraTable>
          </Box>
        )}
      </Card>

      <UpgradeGate
        hasAccess={entitlements.productMatching}
        requiredPlanLabel="Paid"
        featureName="Closest competitor match per product"
      >
        <Card className="mb-5">
          <Flex justify="space-between" align="center" mb="12px">
            <Text fontSize="lg" fontWeight="600" color={textColor}>
              Closest competitor match per product
            </Text>
            <Badge colorScheme="gray">Title-similarity match, MVP</Badge>
          </Flex>
          {productMatches.length === 0 ? (
            <Text fontSize="sm" color="secondaryGray.600">
              No confident matches found yet between your active products and scraped competitor
              listings in this category.
            </Text>
          ) : (
            <Box overflowX="auto">
              <ChakraTable variant="simple">
                <Thead>
                  <Tr>
                    <Th>Your product</Th>
                    <Th>Your price</Th>
                    <Th>Closest match</Th>
                    <Th>Their price</Th>
                    <Th>Confidence</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {productMatches.map((match) => (
                    <Tr key={match.sellerProductId}>
                      <Td>{match.sellerProductTitle}</Td>
                      <Td>{match.sellerPrice != null ? formatCurrency(match.sellerPrice) : '—'}</Td>
                      <Td>
                        <a href={match.matchedUrl} target="_blank" rel="noreferrer">
                          {match.matchedTitle}
                        </a>{' '}
                        {match.matchedPlatformName && `(${match.matchedPlatformName})`}
                      </Td>
                      <Td>{match.matchedPrice != null ? formatCurrency(match.matchedPrice) : '—'}</Td>
                      <Td>{Math.round(match.confidence * 100)}%</Td>
                    </Tr>
                  ))}
                </Tbody>
              </ChakraTable>
            </Box>
          )}
        </Card>
      </UpgradeGate>

      <UpgradeGate
        hasAccess={entitlements.pricingRecommendations}
        requiredPlanLabel="Paid"
        featureName="Pricing recommendations"
      >
        <Card className="mb-5">
          <Flex justify="space-between" align="center" mb="12px">
            <Text fontSize="lg" fontWeight="600" color={textColor}>
              Pricing recommendations
            </Text>
            <Badge colorScheme="gray">Rule-based: competitor band + your margin floor</Badge>
          </Flex>
          {pricingRecommendations.length === 0 ? (
            <Text fontSize="sm" color="secondaryGray.600">
              Set both cost price and sell price on your active products to get pricing
              recommendations here.
            </Text>
          ) : (
            <Box overflowX="auto">
              <ChakraTable variant="simple">
                <Thead>
                  <Tr>
                    <Th>Product</Th>
                    <Th isNumeric>Current price</Th>
                    <Th isNumeric>Recommended</Th>
                    <Th>Direction</Th>
                    <Th>Why</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {pricingRecommendations.map((rec) => (
                    <Tr key={rec.productId}>
                      <Td>{rec.productTitle}</Td>
                      <Td isNumeric>{formatCurrency(rec.currentPrice)}</Td>
                      <Td isNumeric>{formatCurrency(rec.recommendedPrice)}</Td>
                      <Td>
                        <Badge
                          colorScheme={rec.direction === 'increase' ? 'green' : rec.direction === 'decrease' ? 'red' : 'gray'}
                        >
                          {rec.direction}
                        </Badge>
                        {rec.marginConstrained && (
                          <Badge colorScheme="orange" ml="4px">
                            margin-constrained
                          </Badge>
                        )}
                      </Td>
                      <Td>
                        <Text fontSize="xs" color="secondaryGray.600">
                          {rec.rationale}
                        </Text>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </ChakraTable>
            </Box>
          )}
        </Card>
      </UpgradeGate>

      <UpgradeGate
        hasAccess={entitlements.anomalyDetection}
        requiredPlanLabel="Premium"
        featureName="Competitor price anomalies"
      >
        <Card className="mb-5">
          <Flex justify="space-between" align="center" mb="12px">
            <Text fontSize="lg" fontWeight="600" color={textColor}>
              Competitor price anomalies
            </Text>
            <Badge colorScheme="gray">IQR outliers, last 7 days</Badge>
          </Flex>
          {priceAnomalies.length === 0 ? (
            <Text fontSize="sm" color="secondaryGray.600">
              No unusual competitor price moves detected in the last 7 days.
            </Text>
          ) : (
            <Box overflowX="auto">
              <ChakraTable variant="simple">
                <Thead>
                  <Tr>
                    <Th>Product</Th>
                    <Th>Platform</Th>
                    <Th isNumeric>Was</Th>
                    <Th isNumeric>Now</Th>
                    <Th isNumeric>Change</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {priceAnomalies.map((a) => (
                    <Tr key={a.productId}>
                      <Td>{a.title}</Td>
                      <Td>{a.platformName ?? '—'}</Td>
                      <Td isNumeric>{formatCurrency(a.oldPrice)}</Td>
                      <Td isNumeric>{formatCurrency(a.newPrice)}</Td>
                      <Td isNumeric>
                        <Badge colorScheme={a.pctChange > 0 ? 'red' : 'green'}>
                          {a.pctChange > 0 ? '+' : ''}
                          {a.pctChange}%
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </ChakraTable>
            </Box>
          )}
        </Card>
      </UpgradeGate>

      <UpgradeGate hasAccess={entitlements.peerBenchmarks} requiredPlanLabel="Premium" featureName="Peers in your domain">
        <Card className="mb-5">
          <Flex justify="space-between" align="center" mb="12px">
            <Text fontSize="lg" fontWeight="600" color={textColor}>
              Peers in your domain
            </Text>
            {domain && peers.length === 0 && (
              <Badge colorScheme="gray">No peers have opted in to be visible yet</Badge>
            )}
          </Flex>
          <Box overflowX="auto">
            <ChakraTable variant="simple">
              <Thead>
                <Tr>
                  <Th>Seller</Th>
                  <Th>Shares rating</Th>
                  <Th>Shares price positioning</Th>
                  <Th>Shares category rank</Th>
                </Tr>
              </Thead>
              <Tbody>
                {peers.map((peer) => (
                  <Tr key={peer.sellerId}>
                    <Td>{peer.displayName ?? 'Anonymous seller'}</Td>
                    <Td>{peer.showRating ? 'Yes' : 'No'}</Td>
                    <Td>{peer.showPricePosition ? 'Yes' : 'No'}</Td>
                    <Td>{peer.showCategoryRank ? 'Yes' : 'No'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </ChakraTable>
          </Box>
        </Card>
      </UpgradeGate>

      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap="20px">
        <Card>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="6px">
            Opt in to be visible to peers
          </Text>
          <Text fontSize="sm" color="secondaryGray.600">
            Choose which of your own stats (rating, price range, response time) other sellers in
            your domain can see. Manage this from Settings &rarr; Public profile.
          </Text>
        </Card>
        <Card>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="6px">
            Where this data comes from
          </Text>
          <Text fontSize="sm" color="secondaryGray.600">
            Benchmarks are computed from anonymized, aggregated seller data in your domain - never
            a direct feed of another seller&apos;s private orders, customers, or churn.
          </Text>
        </Card>
      </Grid>
    </div>
  );
}
