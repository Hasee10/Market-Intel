'use client';

import Link from 'next/link';

import { MarketScopeBanner } from '@/components/marketintel/MarketScopeBanner';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { UpgradeGate } from '@/components/marketintel/UpgradeGate';
import { Tabs } from '@/components/ui/Tabs';
import type {
  CompetitorLandscape,
  CompetitorMatchStats,
  CompetitorOverlap,
} from '@/lib/market-intel/competitors';
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
  scopeSummary: MarketScopeSummary | null;
  allLandscape: CompetitorLandscape | null;
  allOverlap: CompetitorOverlap[];
  allMatchCounts: CompetitorMatchStats[];
};

export default function CompetitorsView({
  hasAccess,
  categoryName,
  trackedDomainCount,
  reportingCurrency,
  landscape,
  overlap,
  matchCounts,
  scopeSummary,
  allLandscape,
  allOverlap,
  allMatchCounts,
}: Props) {
  return (
    <div className="font-outfit">
      <PageHeader
        title="Competitors"
        breadcrumbItems={[
          { title: 'Market', href: PATH_DASHBOARD.market },
          { title: 'Competitors', href: PATH_DASHBOARD.competitors },
        ]}
        actionButton={
          <Link
            href={PATH_DASHBOARD.marketDefinition}
            className="rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300"
          >
            Adjust market definition
          </Link>
        }
      />

      <UpgradeGate
        hasAccess={hasAccess}
        requiredPlanLabel="Paid"
        featureName="Competitor scorecards"
      >
        <Tabs
          items={[
            {
              label: 'All My Products',
              content: (
                <>
                  <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                    Aggregated across every category you track ({trackedDomainCount || 0}{' '}
                    {trackedDomainCount === 1 ? 'domain' : 'domains'}), not just your primary one.
                    Uses each domain&apos;s full default scope (every mapped segment and platform) —
                    for a narrowed view of one category&apos;s price band, brands, or platforms, use
                    its own Market Definition and the Primary Domain tab.
                  </p>
                  <CompetitorScorecardsPanel
                    scopeLabel="your tracked categories"
                    reportingCurrency={reportingCurrency}
                    landscape={allLandscape}
                    overlap={allOverlap}
                    matchCounts={allMatchCounts}
                    exportScope="all"
                  />
                </>
              ),
            },
            {
              label: `Primary Domain${categoryName ? ` (${categoryName})` : ''}`,
              content: (
                <>
                  {scopeSummary && <MarketScopeBanner summary={scopeSummary} />}
                  <CompetitorScorecardsPanel
                    scopeLabel={categoryName ?? 'this market'}
                    reportingCurrency={reportingCurrency}
                    landscape={landscape}
                    overlap={overlap}
                    matchCounts={matchCounts}
                    exportScope="primary"
                  />
                </>
              ),
            },
          ]}
        />
      </UpgradeGate>
    </div>
  );
}
