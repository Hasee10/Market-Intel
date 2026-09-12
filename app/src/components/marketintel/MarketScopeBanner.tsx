'use client';

import Link from 'next/link';
import { MdOutlineTune, MdOutlineWarningAmber } from 'react-icons/md';

import { PATH_DASHBOARD } from '@/lib/paths';
import type { MarketScopeSummary } from '@/lib/market-intel/market/market-definition';

// ROADMAP.md C2, Block 1 of the framework. Every number on an analysis page is
// computed against *some* definition of "the market". Until now that definition
// was a regex in a source file - the seller could not see it, question it, or
// change it, which meant they had to take the median on trust. This strip is
// the definition, echoed back wherever those numbers are shown, with a link to
// go change it.
//
// It also has to be honest when the answer is nothing. Rendering a blank
// dashboard because a category has zero scraped coverage looks like a bug and
// teaches sellers to distrust the product; saying so plainly, and saying why,
// does not.

export type { MarketScopeSummary };

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function priceBandLabel(summary: MarketScopeSummary): string | null {
  const { priceMin, priceMax, priceCurrency } = summary;
  if (priceMin == null && priceMax == null) return null;
  if (priceMin != null && priceMax != null) {
    return `${formatMoney(priceMin, priceCurrency)} – ${formatMoney(priceMax, priceCurrency)}`;
  }
  if (priceMin != null) return `above ${formatMoney(priceMin, priceCurrency)}`;
  return `under ${formatMoney(priceMax as number, priceCurrency)}`;
}

const chip =
  'rounded-md px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';

export function MarketScopeBanner({ summary }: { summary: MarketScopeSummary }) {
  const total = summary.productCount + summary.listingCount;
  const band = priceBandLabel(summary);
  const empty = total === 0;

  const facets: { label: string; value: string }[] = [];
  if (
    summary.segmentLabels.length > 0 &&
    summary.segmentLabels.length < summary.totalSegmentCount
  ) {
    facets.push({ label: 'Segments', value: summary.segmentLabels.join(', ') });
  }
  if (band) facets.push({ label: 'Price band', value: band });
  if (summary.brands.length > 0) facets.push({ label: 'Brands', value: summary.brands.join(', ') });
  if (summary.cities.length > 0) facets.push({ label: 'Cities', value: summary.cities.join(', ') });

  const Icon = empty ? MdOutlineWarningAmber : MdOutlineTune;

  return (
    <div
      className={`font-outfit mb-5 rounded-2xl border bg-white px-5 py-3.5 dark:bg-gray-900 ${
        empty ? 'border-orange-400 dark:border-orange-500' : 'border-gray-200 dark:border-gray-800'
      }`}
    >
      <div className="flex flex-col items-start gap-2.5 md:flex-row md:items-center">
        <Icon
          className={`size-5 shrink-0 ${
            empty ? 'text-orange-500 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'
          }`}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          {empty ? (
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No scraped listings match your market definition yet.
            </p>
          ) : (
            <p className="text-sm text-gray-900 dark:text-white">
              <strong className="font-bold">{total.toLocaleString()}</strong>{' '}
              {total === 1 ? 'listing' : 'listings'} across{' '}
              <strong className="font-bold">{summary.platformNames.length}</strong>{' '}
              {summary.platformNames.length === 1 ? 'platform' : 'platforms'} match your definition
              of <strong className="font-bold">{summary.categoryName}</strong>.
            </p>
          )}

          {empty ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {summary.hasTaxonomy
                ? 'The categories mapped to this market have no live scraped rows right now — either your filters are too narrow, or the sources covering them have not returned data yet. Every figure below will be blank until that changes.'
                : 'No scraped source covers this category yet, so there is nothing to compare against. This is a data-coverage gap, not a filter you can widen.'}
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {/* title= rather than a Tooltip component: the full platform list
                  is a nice-to-have on hover, not worth a JS popover. */}
              <span
                title={summary.platformNames.join(', ')}
                className="rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-gray-800 dark:text-brand-400"
              >
                {summary.platformNames.slice(0, 3).join(', ')}
                {summary.platformNames.length > 3
                  ? ` +${summary.platformNames.length - 3}`
                  : ''}
              </span>
              {facets.map((facet) => (
                <span key={facet.label} className={chip}>
                  {facet.label}: {facet.value}
                </span>
              ))}
              {summary.isDefault && facets.length === 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Using the default scope — every mapped segment, no price band.
                </span>
              )}
            </div>
          )}
        </div>

        <Link
          href={PATH_DASHBOARD.marketDefinition}
          className="shrink-0 text-sm font-semibold text-brand-500 hover:underline dark:text-brand-400"
        >
          {summary.isDefault ? 'Define your market' : 'Edit definition'}
        </Link>
      </div>
    </div>
  );
}

export default MarketScopeBanner;
