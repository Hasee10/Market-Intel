'use client';

import { Box, Button, Tab, TabList, TabPanel, TabPanels, Tabs, Text, useColorModeValue } from '@chakra-ui/react';
import Link from 'next/link';

import { MarketScopeBanner } from '@/components/marketintel/MarketScopeBanner';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { UpgradeGate } from '@/components/marketintel/UpgradeGate';
import type { CompetitorLandscape, CompetitorMatchStats, CompetitorOverlap, MatchedListing } from '@/lib/market-intel/competitors';
import type { MarketScopeSummary } from '@/lib/market-intel/market-definition';
import { PATH_DASHBOARD } from '@/lib/paths';

import CompetitorScorecardsPanel from './CompetitorScorecardsPanel';

type Props = {
  hasAccess: boolean;
  categoryName: string | null;
  trackedDomainCount: number;
  reportingCurrency: string;
  landscape: CompetitorLandscape | null;
  overlap: CompetitorOverlap[];
  matchCounts: CompetitorMatchStats[];
  matchedListings: MatchedListing[];
  scopeSummary: MarketScopeSummary | null;
  allLandscape: CompetitorLandscape | null;
  allOverlap: CompetitorOverlap[];
  allMatchCounts: CompetitorMatchStats[];
  allMatchedListings: MatchedListing[];
};

export default function CompetitorsView({
  hasAccess,
  categoryName,
  trackedDomainCount,
  reportingCurrency,
  landscape,
  overlap,
  matchCounts,
  matchedListings,
  scopeSummary,
  allLandscape,
  allOverlap,
  allMatchCounts,
  allMatchedListings,
}: Props) {
  const mutedColor = useColorModeValue('secondaryGray.600', 'secondaryGray.500');

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

  return (
    <Box>
      {header}

      <UpgradeGate hasAccess={hasAccess} requiredPlanLabel="Paid" featureName="Competitor scorecards">
        <Tabs colorScheme="brand" variant="enclosed">
          <TabList>
            <Tab>All My Products</Tab>
            <Tab>Primary Domain{categoryName ? ` (${categoryName})` : ''}</Tab>
          </TabList>
          <TabPanels>
            <TabPanel px="0">
              <Text fontSize="sm" color={mutedColor} mb="16px">
                Aggregated across every category you track ({trackedDomainCount || 0}{' '}
                {trackedDomainCount === 1 ? 'domain' : 'domains'}), not just your primary one. Uses each
                domain&apos;s full default scope (every mapped segment and platform) — for a narrowed view of one
                category&apos;s price band, brands, or platforms, use its own Market Definition and the Primary
                Domain tab.
              </Text>
              <CompetitorScorecardsPanel
                scopeLabel="your tracked categories"
                reportingCurrency={reportingCurrency}
                landscape={allLandscape}
                overlap={allOverlap}
                matchCounts={allMatchCounts}
                matchedListings={allMatchedListings}
                exportFilePrefix="all-products"
              />
            </TabPanel>
            <TabPanel px="0">
              {scopeSummary && <MarketScopeBanner summary={scopeSummary} />}
              <CompetitorScorecardsPanel
                scopeLabel={categoryName ?? 'this market'}
                reportingCurrency={reportingCurrency}
                landscape={landscape}
                overlap={overlap}
                matchCounts={matchCounts}
                matchedListings={matchedListings}
                exportFilePrefix="primary-domain"
              />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </UpgradeGate>
    </Box>
  );
}
