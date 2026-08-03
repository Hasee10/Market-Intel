'use client';

import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Progress,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import Link from 'next/link';
import { useMemo } from 'react';

import Card from 'components/card/Card';
import { MarketScopeBanner } from '@/components/marketintel/MarketScopeBanner';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { UpgradeGate } from '@/components/marketintel/UpgradeGate';
import type { CompetitorLandscape, CompetitorOverlap } from '@/lib/market-intel/competitors';
import type { MarketScopeSummary } from '@/lib/market-intel/market-definition';
import { PATH_DASHBOARD } from '@/lib/paths';

type Props = {
  hasAccess: boolean;
  categoryName: string | null;
  reportingCurrency: string;
  landscape: CompetitorLandscape | null;
  overlap: CompetitorOverlap[];
  scopeSummary: MarketScopeSummary | null;
};

function formatCurrencyAs(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null, digits = 0) {
  if (value == null) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatSignedPercent(value: number | null) {
  if (value == null) return '—';
  const pct = value * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function monthsSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (Date.now() - then) / (1000 * 60 * 60 * 24 * 30);
}

// The three things a scorecard is for, phrased as the seller would ask them.
// Kept as literal strings on the column headers rather than in a legend at the
// bottom, because a metric whose meaning lives elsewhere gets misread.
const COLUMN_HELP = {
  assortment: 'Share of every identified listing in your market that belongs to this seller.',
  priceIndex: 'Their median price against your market median. Negative means they undercut it.',
  repricing:
    'Share of price observations that moved in the window. We observe every two days, so a price that moves and moves back is invisible — this is a floor, not a count.',
  stock: 'Share of their listings currently in stock. Blank where the source does not report stock.',
  sold: 'Platform-reported units sold, rounded by the platform itself. A demand proxy, not sales data.',
  overlap:
    'Your SKUs with a plausible title match in their assortment, and how many of those you price below them on. Matched by title similarity, so treat it as directional.',
};

export default function CompetitorsView({
  hasAccess,
  categoryName,
  reportingCurrency,
  landscape,
  overlap,
  scopeSummary,
}: Props) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const mutedColor = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const formatCurrency = (value: number | null) =>
    value == null ? '—' : formatCurrencyAs(value, reportingCurrency);

  const overlapByCompetitor = useMemo(
    () => new Map(overlap.map((row) => [row.externalId, row])),
    [overlap],
  );

  const header = (
    <PageHeader
      title="Competitors"
      breadcrumbItems={[
        { title: 'Market', href: PATH_DASHBOARD.market },
        { title: 'Competitors', href: PATH_DASHBOARD.competitors },
      ]}
      actionButton={
        <Button as={Link} href={PATH_DASHBOARD.marketDefinition} variant="outline" size="sm">
          Adjust market definition
        </Button>
      }
    />
  );

  const scorecards = landscape?.scorecards ?? [];

  return (
    <Box>
      {header}

      {hasAccess && scopeSummary && <MarketScopeBanner summary={scopeSummary} />}

      <UpgradeGate hasAccess={hasAccess} requiredPlanLabel="Paid" featureName="Competitor scorecards">
      {scorecards.length === 0 ? (
        <Card p="24px">
          <Text fontWeight="700" color={textColor} mb="6px">
            No named competitors in {categoryName ?? 'this market'} yet
          </Text>
          <Text fontSize="sm" color={mutedColor} mb="10px">
            A competitor scorecard needs a listing that names the merchant behind it. Most of the sources we
            track are single retailers — on those, the retailer <em>is</em> the seller, so there is nobody to
            name. Daraz is the marketplace in your market that carries merchant identity.
          </Text>
          <Text fontSize="sm" color={mutedColor}>
            {landscape && landscape.anonymousSkuCount > 0
              ? `${landscape.anonymousSkuCount.toLocaleString()} listings in your market carry no seller identity, which is why this page is empty rather than showing them as one anonymous competitor. Those listings still feed every other figure on the Market page.`
              : 'Once a marketplace source returns listings inside your market definition, the competitors behind them appear here.'}
          </Text>
        </Card>
      ) : (
        <>
          <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap="20px" mb="20px">
            <Card p="20px">
              <Text fontSize="sm" color={mutedColor}>
                Named competitors
              </Text>
              <Text fontSize="28px" fontWeight="700" color={textColor}>
                {scorecards.length}
              </Text>
              <Text fontSize="xs" color={mutedColor}>
                across {landscape?.platformsWithIdentity.join(', ') || '—'}
              </Text>
            </Card>
            <Card p="20px">
              <Text fontSize="sm" color={mutedColor}>
                Listings with a named seller
              </Text>
              <Text fontSize="28px" fontWeight="700" color={textColor}>
                {(landscape?.identifiedSkuCount ?? 0).toLocaleString()}
              </Text>
              <Text fontSize="xs" color={mutedColor}>
                {(landscape?.anonymousSkuCount ?? 0).toLocaleString()} more have no seller to attribute
              </Text>
            </Card>
            <Card p="20px">
              <Text fontSize="sm" color={mutedColor}>
                Your market median
              </Text>
              <Text fontSize="28px" fontWeight="700" color={textColor}>
                {formatCurrency(landscape?.marketMedianPrice ?? null)}
              </Text>
              <Text fontSize="xs" color={mutedColor}>
                every price index below is measured against this
              </Text>
            </Card>
          </Grid>

          <Card p="0" overflowX="auto" mb="20px">
            <Box p="20px" pb="8px">
              <Text fontWeight="700" color={textColor}>
                Scorecards
              </Text>
              <Text fontSize="sm" color={mutedColor}>
                Ranked by assortment size inside your market definition, not overall — a seller with 40,000
                listings elsewhere counts here only for what they list against you. Repricing is measured over
                the last {landscape?.lookbackDays ?? 30} days.
              </Text>
            </Box>
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Competitor</Th>
                  <Th isNumeric>
                    <Tooltip label={COLUMN_HELP.assortment} hasArrow>
                      <span>Assortment</span>
                    </Tooltip>
                  </Th>
                  <Th isNumeric>Median price</Th>
                  <Th isNumeric>
                    <Tooltip label={COLUMN_HELP.priceIndex} hasArrow>
                      <span>vs market</span>
                    </Tooltip>
                  </Th>
                  <Th isNumeric>
                    <Tooltip label={COLUMN_HELP.repricing} hasArrow>
                      <span>Repricing</span>
                    </Tooltip>
                  </Th>
                  <Th isNumeric>
                    <Tooltip label={COLUMN_HELP.stock} hasArrow>
                      <span>In stock</span>
                    </Tooltip>
                  </Th>
                  <Th isNumeric>
                    <Tooltip label={COLUMN_HELP.sold} hasArrow>
                      <span>Units sold*</span>
                    </Tooltip>
                  </Th>
                  <Th isNumeric>
                    <Tooltip label={COLUMN_HELP.overlap} hasArrow>
                      <span>Overlap / you cheaper</span>
                    </Tooltip>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {scorecards.map((competitor) => {
                  const head2head = overlapByCompetitor.get(competitor.externalId);
                  const tenure = monthsSince(competitor.firstSeenAt);
                  return (
                    <Tr key={competitor.externalId}>
                      <Td>
                        <Text fontWeight="600" color={textColor}>
                          {competitor.name}
                        </Text>
                        <Flex gap="6px" align="center" wrap="wrap" mt="2px">
                          <Badge colorScheme="purple" variant="subtle" fontSize="10px" textTransform="none">
                            {competitor.platformName}
                          </Badge>
                          <Text fontSize="xs" color={mutedColor}>
                            {competitor.brandCount} {competitor.brandCount === 1 ? 'brand' : 'brands'}
                            {tenure != null && tenure < 2 ? ' · new to this market' : ''}
                          </Text>
                        </Flex>
                      </Td>
                      <Td isNumeric>
                        <Text fontSize="sm" color={textColor}>
                          {competitor.skuCount.toLocaleString()}
                        </Text>
                        <Progress
                          value={competitor.assortmentShare * 100}
                          size="xs"
                          colorScheme="brand"
                          borderRadius="4px"
                          mt="4px"
                        />
                        <Text fontSize="xs" color={mutedColor}>
                          {formatPercent(competitor.assortmentShare, 1)} of named supply
                        </Text>
                      </Td>
                      <Td isNumeric>{formatCurrency(competitor.medianPrice)}</Td>
                      <Td isNumeric>
                        <Text
                          fontSize="sm"
                          color={
                            competitor.priceIndex == null
                              ? mutedColor
                              : competitor.priceIndex < 0
                                ? 'red.500'
                                : 'green.500'
                          }
                        >
                          {formatSignedPercent(competitor.priceIndex)}
                        </Text>
                      </Td>
                      <Td isNumeric>
                        {competitor.priceChangeRate == null ? (
                          <Text fontSize="xs" color={mutedColor}>
                            not yet observed
                          </Text>
                        ) : (
                          <>
                            <Text fontSize="sm" color={textColor}>
                              {formatPercent(competitor.priceChangeRate, 1)}
                            </Text>
                            <Text fontSize="xs" color={mutedColor}>
                              {competitor.observedSkuCount} SKUs tracked
                            </Text>
                          </>
                        )}
                      </Td>
                      <Td isNumeric>{formatPercent(competitor.inStockRate)}</Td>
                      <Td isNumeric>
                        {competitor.soldUnits > 0 ? competitor.soldUnits.toLocaleString() : '—'}
                      </Td>
                      <Td isNumeric>
                        {!head2head || head2head.overlapCount === 0 ? (
                          <Text fontSize="xs" color={mutedColor}>
                            no match found
                          </Text>
                        ) : (
                          <>
                            <Text fontSize="sm" color={textColor}>
                              {head2head.winCount}/{head2head.overlapCount}
                            </Text>
                            <Text fontSize="xs" color={mutedColor}>
                              you are {formatSignedPercent(head2head.priceGap)} on median
                            </Text>
                          </>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Card>

          <Card p="20px">
            <Text fontWeight="700" color={textColor} mb="6px">
              How to read this
            </Text>
            <Text fontSize="sm" color={mutedColor} mb="6px">
              *Units sold is reported by the platform and rounded by it (&quot;1.2K sold&quot;). It is the only
              demand-side signal any source we track exposes, and it is a proxy — never treat it as your
              competitor&apos;s revenue.
            </Text>
            <Text fontSize="sm" color={mutedColor} mb="6px">
              Overlap and the cheaper-than count are computed by comparing product titles, over your 60 most
              recently updated active products. They point you at the right competitor to look at; they are not
              a reconciled catalog match.
            </Text>
            <Text fontSize="sm" color={mutedColor}>
              Every figure is confined to your market definition. Change the segments, price band or platforms
              and this list changes with it.
            </Text>
          </Card>
        </>
      )}
      </UpgradeGate>
    </Box>
  );
}
