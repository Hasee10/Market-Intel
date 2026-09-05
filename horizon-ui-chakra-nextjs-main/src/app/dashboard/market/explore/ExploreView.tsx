'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Card } from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Field';
import { MarketScopeBanner } from '@/components/marketintel/MarketScopeBanner';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { UpgradeGate } from '@/components/marketintel/UpgradeGate';
import type { CompetitorLandscape } from '@/lib/market-intel/market/competitors';
import type { MarketScopeSummary } from '@/lib/market-intel/market/market-definition';
import { PATH_DASHBOARD } from '@/lib/paths';

import CompetitorScorecardsPanel from '../competitors/CompetitorScorecardsPanel';
import { ProductPreLaunchPanel } from '@/components/marketintel/ProductPreLaunchPanel';

type Category = { id: string; slug: string; name: string };

type Props = {
  hasAccess: boolean;
  categories: Category[];
  selectedCategorySlug: string | null;
  selectedCategoryName: string | null;
  reportingCurrency: string;
  landscape: CompetitorLandscape | null;
  scopeSummary: MarketScopeSummary | null;
};

export default function ExploreView({
  hasAccess,
  categories,
  selectedCategorySlug,
  selectedCategoryName,
  reportingCurrency,
  landscape,
  scopeSummary,
}: Props) {
  const router = useRouter();
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [tracked, setTracked] = useState(false);

  const selectedCategoryId = categories.find((c) => c.slug === selectedCategorySlug)?.id ?? null;

  const handleCategoryChange = (slug: string) => {
    router.push(slug ? `${PATH_DASHBOARD.explore}?category=${slug}` : PATH_DASHBOARD.explore);
  };

  const handleTrackCategory = async () => {
    if (!selectedCategoryId) return;
    setTracking(true);
    setTrackError(null);
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: selectedCategoryId }),
      });
      const result = await response.json();
      if (!response.ok || !result.succeeded) {
        setTrackError(result.errors?.join(', ') || 'Could not track this category.');
        return;
      }
      setTracked(true);
    } catch {
      setTrackError('Could not track this category. Please try again.');
    } finally {
      setTracking(false);
    }
  };

  return (
    <div className="font-outfit">
      <PageHeader
        title="Explore"
        breadcrumbItems={[
          { title: 'Market', href: PATH_DASHBOARD.market },
          { title: 'Explore', href: PATH_DASHBOARD.explore },
        ]}
      />

      <UpgradeGate hasAccess={hasAccess} requiredPlanLabel="Paid" featureName="Category explorer">
        <Card className="mb-6">
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Preview competitor pricing, ratings and sales volume for any category before you launch
            a product there — no need to already sell in it. This uses the default market scope
            (every mapped segment, no price band), since there is no product of yours yet to narrow
            it by.
          </p>
          <Field label="Category">
            <Select
              value={selectedCategorySlug ?? ''}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="max-w-sm"
            >
              <option value="">Pick a category to preview its market</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        {!selectedCategorySlug ? (
          <Card>
            <p className="font-bold text-gray-900 dark:text-white">Pick a category to preview its market</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              You&apos;ll see named competitors, pricing, stock and demand signals for that category
              — the same view as your Competitors page, just for a market you don&apos;t track yet.
            </p>
          </Card>
        ) : (
          <>
            {scopeSummary && <MarketScopeBanner summary={scopeSummary} />}

            <div className="mb-6 flex flex-wrap items-center justify-between gap-2.5">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Browsing <strong className="font-semibold text-gray-900 dark:text-white">{selectedCategoryName}</strong> —
                not yet one of your tracked categories.
              </p>
              <div className="flex items-center gap-2.5">
                {trackError && <span className="text-sm text-error-600 dark:text-error-500">{trackError}</span>}
                <button
                  type="button"
                  onClick={handleTrackCategory}
                  disabled={tracking || tracked}
                  className="rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {tracked ? 'Tracking this category' : tracking ? 'Adding…' : 'Track this category'}
                </button>
              </div>
            </div>

            {/* The product-level answer the category picker above cannot
                give on its own: not "what does this whole category look
                like" but "what does THIS item sell for, and would my price
                undercut the people already selling it". */}
            <Card className="mb-6" title="Check a specific product before you stock it">
              <ProductPreLaunchPanel
                categorySlug={selectedCategorySlug}
                categoryName={selectedCategoryName}
                currency={reportingCurrency}
              />
            </Card>

            <CompetitorScorecardsPanel
              scopeLabel={selectedCategoryName ?? 'this market'}
              reportingCurrency={reportingCurrency}
              landscape={landscape}
              overlap={[]}
              matchCounts={[]}
              exportScope="primary"
              showMatchedListingsExport={false}
            />
          </>
        )}
      </UpgradeGate>
    </div>
  );
}
