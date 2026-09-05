'use client';

import { useState } from 'react';
import { MdOutlineStar, MdOutlineSearch } from 'react-icons/md';

import { Field, Input } from '@/components/ui/Field';
import { ProductThumb } from '@/components/ui/ProductThumb';
import { Pill } from '@/components/ui/Table';
import { objectsToCsv, triggerCsvDownload } from '@/lib/csv';
import type { PreLaunchInsight } from '@/lib/market-intel/market/pre-launch';
import type { IApiResponse } from '@/types/api-response';

const dateStamp = () => new Date().toISOString().slice(0, 10);

// The product-level answer Explore's category picker cannot give on its
// own: not "what does this whole category look like" but "what does THIS
// item sell for, who already sells it, and would my price undercut them".
//
// Deliberately a search box, not a dropdown of the category's own products -
// the whole point is a product the seller does not carry yet, so there is
// nothing in their own catalogue to pick from.

const MATCH_STRENGTH_LABEL: Record<string, { label: string; tone: 'success' | 'brand' | 'warning' }> = {
  strong: { label: 'Strong', tone: 'success' },
  likely: { label: 'Likely', tone: 'brand' },
  loose: { label: 'Loose', tone: 'warning' },
};

export function ProductPreLaunchPanel({
  categorySlug,
  categoryName,
  currency,
  className = '',
}: {
  categorySlug: string;
  categoryName: string | null;
  currency: string;
  className?: string;
}) {
  const [title, setTitle] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreLaunchInsight | null>(null);

  const money = (v: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

  const runCheck = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const query = new URLSearchParams({ title: trimmed, categorySlug });
      if (categoryName) query.set('categoryName', categoryName);
      const price = Number(priceInput);
      if (priceInput.trim() && Number.isFinite(price) && price > 0) {
        query.set('intendedPrice', String(price));
      }

      const response = await fetch(`/api/market/price-check?${query.toString()}`);
      const data: IApiResponse<PreLaunchInsight> = await response.json();

      if (!data.succeeded) {
        setError(data.message || 'Could not check the market for this product.');
        return;
      }
      setResult(data.data);
    } catch {
      setError('Could not check the market for this product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Exports exactly the sample shown, not the full matched set - the API
  // caps `listings` at MAX_SAMPLE_LISTINGS server-side (see pre-launch.ts),
  // same as what "Closest matches" already displays. matchCount above it
  // already tells the seller how many more matched but aren't listed here.
  const exportListingsCsv = (insight: PreLaunchInsight) => {
    const csv = objectsToCsv(
      insight.listings.map((listing) => ({
        title: listing.title,
        platform: listing.platformName ?? '',
        price: listing.price ?? '',
        matchStrength: MATCH_STRENGTH_LABEL[listing.matchStrength]?.label ?? listing.matchStrength,
        rating: listing.rating ?? '',
        soldCount: listing.soldCount ?? '',
        url: listing.url,
      })),
      [
        { key: 'title', label: 'Listing' },
        { key: 'platform', label: 'Platform' },
        { key: 'price', label: `Price (${insight.currency})` },
        { key: 'matchStrength', label: 'Match strength' },
        { key: 'rating', label: 'Rating' },
        { key: 'soldCount', label: 'Sold' },
        { key: 'url', label: 'URL' },
      ],
    );
    const slug = insight.query.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    triggerCsvDownload(csv, `pre-launch-check-${slug || 'product'}-${dateStamp()}.csv`);
  };

  return (
    <div className={className}>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Name the product you&apos;re thinking of stocking. This searches the same scraped listings
        as the Competitors page, scoped to {categoryName ?? 'this category'} - not the whole
        category&apos;s aggregate, just the market for this one item.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Product">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runCheck()}
              placeholder="e.g. Espresso Coffee Machine 15 Bar"
            />
          </Field>
        </div>
        <div className="sm:w-44">
          <Field label="Intended price" hint="Optional">
            <Input
              type="number"
              min={0}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runCheck()}
              placeholder={currency}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={runCheck}
          disabled={loading || !title.trim()}
          className="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MdOutlineSearch className="size-4" aria-hidden="true" />
          {loading ? 'Checking…' : 'Check the market'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-error-600 dark:text-error-500">{error}</p>}

      {result && (
        <div className="mt-5 border-t border-gray-100 pt-5 dark:border-gray-800">
          {result.matchCount === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No comparable listings found for &quot;{result.query}&quot; in {categoryName ?? 'this category'}. Either
              nobody scraped tracks it yet, or the title is too specific to match against - try a
              more generic version of the name.
            </p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Matched listings', value: String(result.matchCount) },
                  { label: 'Distinct sellers', value: String(result.competitorCount) },
                  { label: 'Platforms', value: String(result.platformCount) },
                  {
                    label: 'Median (matched)',
                    value: result.matchedPriceBand ? money(result.matchedPriceBand.median) : '—',
                  },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-[11px] tracking-wide text-gray-500 uppercase dark:text-gray-400">
                      {stat.label}
                    </p>
                    <p className="text-lg font-semibold text-gray-900 tabular-nums dark:text-white">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {!result.hasEnoughData && (
                <p className="mb-4 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:bg-gray-800 dark:text-orange-400">
                  Only {result.matchCount} listing{result.matchCount === 1 ? '' : 's'} matched - too
                  few to treat this as a confident read on the market. Take the figures below as a
                  hint, not a fact.
                </p>
              )}

              {result.pricePosition && (
                <p className="mb-4 text-[15px] leading-snug text-gray-900 dark:text-white">
                  At <span className="font-semibold">{money(result.pricePosition.intendedPrice)}</span> you would
                  be{' '}
                  <span
                    className={`font-semibold ${
                      result.pricePosition.verdict === 'at market'
                        ? 'text-gray-700 dark:text-gray-300'
                        : result.pricePosition.verdict === 'below market'
                          ? 'text-success-700 dark:text-success-500'
                          : 'text-error-700 dark:text-error-500'
                    }`}
                  >
                    {result.pricePosition.verdict}
                  </span>
                  {result.pricePosition.verdict !== 'at market' && (
                    <> ({Math.abs(result.pricePosition.vsMatchedMedian * 100).toFixed(0)}%{' '}
                      {result.pricePosition.verdict === 'below market' ? 'below' : 'above'} the matched median)</>
                  )}
                  , undercutting {result.pricePosition.cheaperThanCount} of {result.matchCount} matched listings.
                </p>
              )}

              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  Closest matches
                </p>
                <button
                  type="button"
                  onClick={() => exportListingsCsv(result)}
                  className="text-xs font-medium text-brand-500 hover:underline"
                >
                  Export CSV
                </button>
              </div>
              <ul className="flex flex-col gap-2">
                {result.listings.map((listing, i) => {
                  const strength = MATCH_STRENGTH_LABEL[listing.matchStrength];
                  return (
                    <li key={`${listing.url}-${i}`} className="flex items-center gap-3">
                      <ProductThumb src={listing.imageUrl} alt="" categoryName={null} />
                      <a
                        href={listing.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-sm text-gray-700 hover:text-brand-500 hover:underline dark:text-gray-300"
                      >
                        {listing.title}
                      </a>
                      {strength && <Pill tone={strength.tone}>{strength.label}</Pill>}
                      {listing.platformName && <Pill tone="brand">{listing.platformName}</Pill>}
                      <span className="w-20 shrink-0 text-right text-sm font-semibold text-gray-900 tabular-nums dark:text-white">
                        {listing.price != null ? money(listing.price) : '—'}
                      </span>
                      {listing.rating != null && (
                        <span className="flex w-16 shrink-0 items-center justify-end gap-0.5 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                          <MdOutlineStar className="size-3 text-yellow-400" aria-hidden="true" />
                          {listing.rating.toFixed(1)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ProductPreLaunchPanel;
