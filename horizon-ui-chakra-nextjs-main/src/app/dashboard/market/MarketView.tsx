'use client';

import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Table,
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

import Card from 'components/card/Card';
import LineChart from '@/components/charts/LineChart';

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
    <Box>
      <PageHeader
        title="Market"
        actionButton={
          <Flex gap="8px">
            <Button as={Link} href={PATH_DASHBOARD.competitors} variant="brand" size="sm">
              Competitors
            </Button>
            <Button as={Link} href={PATH_DASHBOARD.marketDefinition} variant="outline" size="sm">
              Market definition
            </Button>
          </Flex>
        }
      />

      {/* ROADMAP.md C2. Everything below this line is computed against the
          scope this strip describes, so it goes first - a median with no
          stated definition is a number the seller has to take on trust. */}
      {scopeSummary && <MarketScopeBanner summary={scopeSummary} />}

      {marketInsight && <InsightStrip insight={marketInsight} />}

      {freshness.length > 0 && (
        <Flex wrap="wrap" gap="8px" mb="16px">
          {freshness.map((f) => (
            <Badge key={f.platformName} colorScheme="gray" borderRadius="8px" px="8px" py="2px">
              {f.platformName}: scraped {formatRelativeTime(f.lastScrapedAt)}
            </Badge>
          ))}
        </Flex>
      )}

      <Alert status="info" borderRadius="16px" mb="20px">
        <AlertIcon />
        <Box>
          <AlertTitle>Peer benchmarking, not surveillance</AlertTitle>
          <AlertDescription>
            You only see aggregate or seller-opted-in fields for other sellers in your domain
            (e.g. rating, price positioning, response time). Nothing private about a
            competitor&apos;s business is ever shown.
          </AlertDescription>
        </Box>
      </Alert>

      {!domain && (
        <Alert status="warning" borderRadius="16px" mb="20px">
          <AlertIcon />
          <Flex justify="space-between" align="center" w="100%">
            <Text fontSize="sm">
              You haven&apos;t set a domain yet, so we can&apos;t show you peer benchmarks.
            </Text>
            <Button as={Link} href={PATH_ONBOARDING} size="sm" variant="brand">
              Choose domain
            </Button>
          </Flex>
        </Alert>
      )}

      <StatsGrid data={domainStats} columns={4} />

      <UpgradeGate hasAccess={entitlements.peerBenchmarks} requiredPlanLabel="Premium" featureName="Domain benchmarks">
        <Card mb="20px">
          <Flex justify="space-between" align="center" mb="12px">
            <Text fontSize="lg" fontWeight="600" color={textColor}>
              Domain benchmarks
            </Text>
          </Flex>
          {/* Benchmarks stay empty until MIN_SAMPLE_SIZE (3) sellers in this
              category have opted in - see benchmarks-job.ts. That's a real
              anonymity floor, not a bug, but an unexplained blank table reads
              as broken software, so say why rather than showing an empty
              grid. */}
          {benchmarks.length === 0 ? (
            <Alert status="info" borderRadius="12px">
              <AlertIcon />
              <Box>
                <AlertTitle fontSize="sm">Not enough sellers in your domain yet</AlertTitle>
                <AlertDescription fontSize="sm">
                  Peer benchmarks need at least 3 opted-in sellers in a category before we publish
                  them, so no single seller&apos;s numbers can be reverse-engineered from the
                  aggregate. We&apos;ll turn this on for your domain automatically once it reaches
                  that threshold — nothing for you to do. Everything else on this page is drawn from
                  scraped market data and works today.
                </AlertDescription>
              </Box>
            </Alert>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Metric</Th>
                    <Th>P25</Th>
                    <Th>Median</Th>
                    <Th>P75</Th>
                    <Th>Sample size</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {benchmarks.map((row) => (
                    <Tr key={row.metricName}>
                      <Td>{formatMetric(row.metricName)}</Td>
                      <Td>{row.p25 ?? '—'}</Td>
                      <Td>{row.median ?? '—'}</Td>
                      <Td>{row.p75 ?? '—'}</Td>
                      <Td>{row.sampleSize}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </Card>
      </UpgradeGate>

      <Card mb="20px">
        <Flex justify="space-between" align="center" mb="12px">
          <Text fontSize="lg" fontWeight="600" color={textColor}>
            Category pricing (market-wide)
          </Text>
          {domain && !categoryPricing && (
            <Badge colorScheme="gray">No market pricing data for this category yet</Badge>
          )}
        </Flex>
        {categoryPricing ? (
          <>
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Min</Th>
                    <Th>P25</Th>
                    <Th>Median</Th>
                    <Th>P75</Th>
                    <Th>Max</Th>
                    <Th>Average</Th>
                    <Th>Listings tracked</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  <Tr>
                    <Td>{formatCurrency(categoryPricing.minPrice)}</Td>
                    {/* p25/p75 are null below migration 026's sample-size threshold inside
                        market_scope_price_stats - showing "-" here instead of coercing
                        through formatCurrency(null), which Intl.NumberFormat would
                        silently render as a misleading "Rs 0". */}
                    <Td>{categoryPricing.p25 != null ? formatCurrency(categoryPricing.p25) : '—'}</Td>
                    <Td>{formatCurrency(categoryPricing.median)}</Td>
                    <Td>{categoryPricing.p75 != null ? formatCurrency(categoryPricing.p75) : '—'}</Td>
                    <Td>{formatCurrency(categoryPricing.maxPrice)}</Td>
                    <Td>{formatCurrency(categoryPricing.avgPrice)}</Td>
                    <Td>{categoryPricing.count}</Td>
                  </Tr>
                </Tbody>
              </Table>
            </Box>
            <Text fontSize="xs" color="secondaryGray.600" mt="8px">
              Scraped from {categoryPricing.samplePlatforms.join(', ')} - refreshed automatically
              every 2 days.
            </Text>
          </>
        ) : (
          <Text fontSize="sm" color="secondaryGray.600">
            We haven&apos;t scraped competitor pricing for this category yet. Coverage is
            expanding source by source.
          </Text>
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
                  xaxis: { categories: priceForecast.points.map((p) => p.date.slice(5)) },
                  dataLabels: { enabled: false },
                  stroke: { curve: 'smooth', width: [3, 3], dashArray: [0, 6] },
                  colors: ['#4318FF', '#A3AED0'],
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
                  xaxis: { categories: priceTrend.map((p) => p.date.slice(5)) },
                  dataLabels: { enabled: false },
                  stroke: { curve: 'smooth', width: 3 },
                  colors: ['#4318FF'],
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

      <Card mb="20px">
        <Text fontSize="lg" fontWeight="600" color={textColor} mb="12px">
          Competitor stock-outs
        </Text>
        {stockOuts.length === 0 ? (
          <Text fontSize="sm" color="secondaryGray.600">
            No tracked competitor is currently showing out of stock in your category.
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple">
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
            </Table>
          </Box>
        )}
      </Card>

      <UpgradeGate
        hasAccess={entitlements.productMatching}
        requiredPlanLabel="Paid"
        featureName="Closest competitor match per product"
      >
        <Card mb="20px">
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
              <Table variant="simple">
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
              </Table>
            </Box>
          )}
        </Card>
      </UpgradeGate>

      <UpgradeGate
        hasAccess={entitlements.pricingRecommendations}
        requiredPlanLabel="Paid"
        featureName="Pricing recommendations"
      >
        <Card mb="20px">
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
              <Table variant="simple">
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
              </Table>
            </Box>
          )}
        </Card>
      </UpgradeGate>

      <UpgradeGate
        hasAccess={entitlements.anomalyDetection}
        requiredPlanLabel="Premium"
        featureName="Competitor price anomalies"
      >
        <Card mb="20px">
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
              <Table variant="simple">
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
              </Table>
            </Box>
          )}
        </Card>
      </UpgradeGate>

      <UpgradeGate hasAccess={entitlements.peerBenchmarks} requiredPlanLabel="Premium" featureName="Peers in your domain">
        <Card mb="20px">
          <Flex justify="space-between" align="center" mb="12px">
            <Text fontSize="lg" fontWeight="600" color={textColor}>
              Peers in your domain
            </Text>
            {domain && peers.length === 0 && (
              <Badge colorScheme="gray">No peers have opted in to be visible yet</Badge>
            )}
          </Flex>
          <Box overflowX="auto">
            <Table variant="simple">
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
            </Table>
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
    </Box>
  );
}
