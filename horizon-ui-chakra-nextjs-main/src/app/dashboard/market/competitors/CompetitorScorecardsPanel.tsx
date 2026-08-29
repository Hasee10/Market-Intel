'use client';

import { Badge, Box, Button, Flex, Grid, HStack, Icon, Progress, Table, Tbody, Td, Text, Th, Thead, Tooltip, Tr, useColorModeValue } from '@chakra-ui/react';
import { useMemo } from 'react';
import {
  MdOutlineStorefront,
  MdOutlineListAlt,
  MdOutlineAttachMoney,
  MdOutlineTrendingDown,
  MdOutlineNewReleases,
  MdOutlineCheckCircle,
} from 'react-icons/md';

import Card from 'components/card/Card';
import { objectsToCsv, triggerCsvDownload } from '@/lib/csv';
import { InsightStrip, type Insight } from '@/components/marketintel/InsightStrip';
import type {
  CompetitorLandscape,
  CompetitorScorecard,
  CompetitorMatchStats,
  CompetitorOverlap,
  MatchedListing,
} from '@/lib/market-intel/competitors';

export type CompetitorScorecardsPanelProps = {
  /** What to call the scope in the empty-state copy, e.g. "Mobiles & Electronics" or "your tracked categories". */
  scopeLabel: string;
  reportingCurrency: string;
  landscape: CompetitorLandscape | null;
  overlap: CompetitorOverlap[];
  matchCounts: CompetitorMatchStats[];
  matchedListings: MatchedListing[];
  /** File-name prefix for the two CSV exports, e.g. "primary-domain" or "all-products". */
  exportFilePrefix: string;
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
  trackedMatches:
    'Your own products where you opened the Competitors drawer and it saved a match against this seller. Builds up from your activity, not a fresh scan — a low or zero count usually means you have not reviewed those products yet.',
};

const dateStamp = () => new Date().toISOString().slice(0, 10);

// Same instant-insight pattern as Overview/Market/Watchlist (InsightStrip.tsx)
// - one plain-English headline about this tab's own competitor landscape,
// picked from the same figures the table below already computes (never a
// separate calculation, so the headline can't disagree with the row it's
// summarising). Priority: the steepest undercutter (>=5% below market -
// direct price pressure, the thing a seller most needs to know first) >
// a competitor new to this market in the last 2 months (same "new to this
// market" signal already shown as a table badge) > the dominant seller by
// assortment (>=30% of named supply - a market with one dominant player
// reads very differently from one that's evenly split) > a calm fallback
// that still states the real tracked count.
function computeCompetitorInsight(landscape: CompetitorLandscape, scopeLabel: string): Insight {
  const scorecards = landscape.scorecards;

  const undercutters = scorecards.filter(
    (c): c is CompetitorScorecard & { priceIndex: number } => c.priceIndex != null && c.priceIndex <= -0.05,
  );
  if (undercutters.length > 0) {
    const worst = undercutters.reduce((a, b) => (b.priceIndex < a.priceIndex ? b : a));
    return {
      tone: 'warning',
      icon: MdOutlineTrendingDown,
      headline: `${worst.name} prices ${formatSignedPercent(worst.priceIndex)} vs your market`,
      detail: 'Your steepest undercutter by price index right now.',
    };
  }

  const newEntrant = scorecards.find((c) => {
    const tenure = monthsSince(c.firstSeenAt);
    return tenure != null && tenure < 2;
  });
  if (newEntrant) {
    return {
      tone: 'neutral',
      icon: MdOutlineNewReleases,
      headline: `${newEntrant.name} entered your market recently`,
      detail: 'New in this market within the last 2 months - worth a look.',
    };
  }

  const dominant = scorecards.reduce((a, b) => (b.assortmentShare > a.assortmentShare ? b : a));
  if (dominant.assortmentShare >= 0.3) {
    return {
      tone: 'neutral',
      icon: MdOutlineStorefront,
      headline: `${dominant.name} carries ${formatPercent(dominant.assortmentShare, 0)} of named supply`,
      detail: 'Your biggest competitor by assortment in this market.',
    };
  }

  return {
    tone: 'good',
    icon: MdOutlineCheckCircle,
    headline: `Tracking ${scorecards.length} named competitor${scorecards.length === 1 ? '' : 's'} in ${scopeLabel}`,
    detail: 'No single seller dominates this market right now.',
  };
}

export default function CompetitorScorecardsPanel({
  scopeLabel,
  reportingCurrency,
  landscape,
  overlap,
  matchCounts,
  matchedListings,
  exportFilePrefix,
}: CompetitorScorecardsPanelProps) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const mutedColor = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const formatCurrency = (value: number | null) =>
    value == null ? '—' : formatCurrencyAs(value, reportingCurrency);

  // Small icon chips on the three headline stats, same "scan by colour"
  // goal as StatsGrid's per-KPI icon/colour on Overview/Market - three
  // fixed, always-called useColorModeValue pairs, not per-row (unlike
  // StatsGrid, this isn't inside a .map() over variable-length data).
  const statIconBg = {
    blue: useColorModeValue('#EBF3FF', 'rgba(66, 133, 244, 0.12)'),
    teal: useColorModeValue('#E6FBF6', 'rgba(5, 205, 153, 0.12)'),
    violet: useColorModeValue('#F1EEFF', 'rgba(139, 92, 246, 0.14)'),
  };
  const statIconColor = {
    blue: useColorModeValue('#2563EB', '#7DA9FF'),
    teal: useColorModeValue('#05966B', '#3DDC97'),
    violet: useColorModeValue('#6D28D9', '#B79CFF'),
  };

  const overlapByCompetitor = useMemo(() => new Map(overlap.map((row) => [row.externalId, row])), [overlap]);

  const matchCountsByCompetitor = useMemo(
    () => new Map(matchCounts.map((row) => [row.externalId, row])),
    [matchCounts],
  );

  const scorecards = landscape?.scorecards ?? [];

  const exportScorecardsCsv = () => {
    const csv = objectsToCsv(
      scorecards.map((c) => ({
        name: c.name,
        platform: c.platformName,
        skuCount: c.skuCount,
        assortmentShare: formatPercent(c.assortmentShare, 1),
        medianPrice: c.medianPrice ?? '',
        priceIndex: formatSignedPercent(c.priceIndex),
        inStockRate: formatPercent(c.inStockRate),
        soldUnits: c.soldUnits,
      })),
      [
        { key: 'name', label: 'Competitor' },
        { key: 'platform', label: 'Platform' },
        { key: 'skuCount', label: 'SKU count' },
        { key: 'assortmentShare', label: 'Assortment share' },
        { key: 'medianPrice', label: `Median price (${reportingCurrency})` },
        { key: 'priceIndex', label: 'vs market' },
        { key: 'inStockRate', label: 'In stock' },
        { key: 'soldUnits', label: 'Units sold*' },
      ],
    );
    triggerCsvDownload(csv, `${exportFilePrefix}-competitor-scorecards-${dateStamp()}.csv`);
  };

  const exportMatchedListingsCsv = () => {
    const csv = objectsToCsv(
      matchedListings.map((m) => ({
        sellerProductTitle: m.sellerProductTitle,
        matchedTitle: m.matchedTitle,
        platform: m.matchedPlatformName ?? '',
        price: m.matchedPrice ?? '',
        currency: m.matchedCurrency ?? '',
        confidence: m.confidence,
        url: m.matchedUrl,
      })),
      [
        { key: 'sellerProductTitle', label: 'Your product' },
        { key: 'matchedTitle', label: 'Matched listing' },
        { key: 'platform', label: 'Platform' },
        { key: 'price', label: 'Price' },
        { key: 'currency', label: 'Currency' },
        { key: 'confidence', label: 'Match confidence' },
        { key: 'url', label: 'URL' },
      ],
    );
    triggerCsvDownload(csv, `${exportFilePrefix}-matched-listings-${dateStamp()}.csv`);
  };

  if (scorecards.length === 0) {
    return (
      <Card p="24px">
        <Text fontWeight="700" color={textColor} mb="6px">
          No named competitors in {scopeLabel} yet
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
    );
  }

  return (
    <>
      <InsightStrip insight={computeCompetitorInsight(landscape!, scopeLabel)} />

      <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap="20px" mb="20px">
        <Card p="20px">
          <Flex align="center" gap="10px" mb="4px">
            <Flex align="center" justify="center" w="32px" h="32px" borderRadius="10px" bg={statIconBg.blue}>
              <Icon as={MdOutlineStorefront} w="16px" h="16px" color={statIconColor.blue} />
            </Flex>
            <Text fontSize="sm" color={mutedColor}>
              Named competitors
            </Text>
          </Flex>
          <Text fontSize="28px" fontWeight="700" color={textColor}>
            {scorecards.length}
          </Text>
          <Text fontSize="xs" color={mutedColor}>
            across {landscape?.platformsWithIdentity.join(', ') || '—'}
          </Text>
        </Card>
        <Card p="20px">
          <Flex align="center" gap="10px" mb="4px">
            <Flex align="center" justify="center" w="32px" h="32px" borderRadius="10px" bg={statIconBg.teal}>
              <Icon as={MdOutlineListAlt} w="16px" h="16px" color={statIconColor.teal} />
            </Flex>
            <Text fontSize="sm" color={mutedColor}>
              Listings with a named seller
            </Text>
          </Flex>
          <Text fontSize="28px" fontWeight="700" color={textColor}>
            {(landscape?.identifiedSkuCount ?? 0).toLocaleString()}
          </Text>
          <Text fontSize="xs" color={mutedColor}>
            {(landscape?.anonymousSkuCount ?? 0).toLocaleString()} more have no seller to attribute
          </Text>
        </Card>
        <Card p="20px">
          <Flex align="center" gap="10px" mb="4px">
            <Flex align="center" justify="center" w="32px" h="32px" borderRadius="10px" bg={statIconBg.violet}>
              <Icon as={MdOutlineAttachMoney} w="16px" h="16px" color={statIconColor.violet} />
            </Flex>
            <Text fontSize="sm" color={mutedColor}>
              Your market median
            </Text>
          </Flex>
          <Text fontSize="28px" fontWeight="700" color={textColor}>
            {formatCurrency(landscape?.marketMedianPrice ?? null)}
          </Text>
          <Text fontSize="xs" color={mutedColor}>
            every price index below is measured against this
          </Text>
        </Card>
      </Grid>

      <Card p="0" overflowX="auto" mb="20px">
        <Flex p="20px" pb="8px" justify="space-between" align="flex-start" wrap="wrap" gap="10px">
          <Box>
            <Text fontWeight="700" color={textColor}>
              Scorecards
            </Text>
            <Text fontSize="sm" color={mutedColor}>
              Ranked by assortment size inside your market definition, not overall — a seller with 40,000
              listings elsewhere counts here only for what they list against you. Repricing is measured over
              the last {landscape?.lookbackDays ?? 30} days.
            </Text>
          </Box>
          <HStack spacing="8px">
            <Button size="sm" variant="outline" onClick={exportScorecardsCsv}>
              Export scorecards CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportMatchedListingsCsv} isDisabled={matchedListings.length === 0}>
              Export matched listings CSV
            </Button>
          </HStack>
        </Flex>
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
              <Th isNumeric>
                <Tooltip label={COLUMN_HELP.trackedMatches} hasArrow>
                  <span>Your tracked matches</span>
                </Tooltip>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {scorecards.map((competitor) => {
              const head2head = overlapByCompetitor.get(competitor.externalId);
              const trackedMatches = matchCountsByCompetitor.get(competitor.externalId);
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
                  <Td isNumeric>{competitor.soldUnits > 0 ? competitor.soldUnits.toLocaleString() : '—'}</Td>
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
                  <Td isNumeric>
                    {!trackedMatches || trackedMatches.matchedProductCount === 0 ? (
                      <Text fontSize="xs" color={mutedColor}>
                        not yet tracked
                      </Text>
                    ) : (
                      <Badge colorScheme="teal" variant="subtle" fontSize="11px">
                        {trackedMatches.matchedProductCount} {trackedMatches.matchedProductCount === 1 ? 'product' : 'products'}
                      </Badge>
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
        <Text fontSize="sm" color={mutedColor} mb="6px">
          &quot;Your tracked matches&quot; is different from overlap above: it only counts products where you
          actually opened the Competitors drawer and a match was saved, so it accumulates over time rather
          than recalculating on every visit. Treat a zero here as &quot;not reviewed yet,&quot; not &quot;no
          match exists.&quot;
        </Text>
        <Text fontSize="sm" color={mutedColor}>
          Every figure is confined to your market definition. Change the segments, price band or platforms
          and this list changes with it.
        </Text>
      </Card>
    </>
  );
}
