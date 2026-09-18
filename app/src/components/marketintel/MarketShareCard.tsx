'use client';

import { Card } from '@/components/ui/Card';
import { MetricHelp } from '@/components/ui/MetricHelp';
import type { MarketShare } from '@/lib/market-intel/market/market-share';

// "Market share" from the product notes. One headline number, its
// denominator in the same breath, and the named-competitor ranking when the
// plan includes it. See market-share.ts for what the number is and is not.
//
// The bar is the seller's slice of the aisle; the rest is everything the
// scraper sees. Kept as one bar rather than a pie because a share this
// small (a few percent is normal) is unreadable as a wedge and honest as a
// sliver.

type Props = { share: MarketShare };

export function MarketShareCard({ share }: Props) {
  const pct = Math.max(0, Math.min(100, share.listingShare));
  const barWidth = pct < 1 && pct > 0 ? 1 : pct; // keep a sliver visible

  return (
    <Card className="mb-5" title="Your share of this market">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{share.listingShare}%</span>
            <MetricHelp label="How market share is estimated">
              {`Your active listings in ${share.categoryName} divided by those plus every active listing scraped in the same category across the ${share.platformsInScope} platform${share.platformsInScope === 1 ? '' : 's'} in your market definition. It is a share of listings, not of revenue or sales.`}
            </MetricHelp>
          </div>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {share.sellerListings.toLocaleString()} of yours beside {share.marketListings.toLocaleString()} scraped listings
          </p>
        </div>

        {share.sellerRankAmongNamed != null && (
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
              #{share.sellerRankAmongNamed}
              <span className="text-base font-medium text-gray-400"> of {share.namedCompetitorCount + 1}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              by catalogue size, among {share.namedCompetitorCount} named sellers
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden="true">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${barWidth}%` }} />
      </div>

      {share.topNamed.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Largest named sellers here
          </p>
          <ul className="space-y-1.5">
            {share.topNamed.map((c) => (
              <li key={`${c.platformName}:${c.name}`} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate text-gray-800 dark:text-gray-200" title={c.name}>
                  {c.name}
                </span>
                <span className="w-24 shrink-0 truncate text-xs text-gray-400">{c.platformName}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <span className="block h-full rounded-full bg-gray-400 dark:bg-gray-500" style={{ width: `${Math.min(100, c.share)}%` }} />
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {c.skuCount.toLocaleString()} · {c.share}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 space-y-0.5 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
        {share.caveats.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </Card>
  );
}

export default MarketShareCard;
