'use client';

import { MdOutlineStar } from 'react-icons/md';

import {
  analyseThreats,
  MIN_CREDIBLE_REVIEWS,
  THREAT_BAND_LABEL,
  type RatedListing,
} from '@/lib/market-intel/core/competitor-threat';

// Which competitors are actually dangerous - cheaper than you AND well
// regarded - rather than merely cheaper.
//
// Leads with the finding in words and uses the plot as support, which is the
// lesson from the price panel: a chart that makes the reader decode
// positions into an answer is slower than the sentence it was drawn to
// replace. The scatter earns its place here because there are genuinely two
// variables, but the threats are still named underneath it.
//
// Renders nothing at all when the market has no rating coverage. Only Daraz
// and PriceOye publish ratings, so on a fashion or auto market served by
// single-retailer sites this is empty by construction - and an empty chart
// with an axis is worse than no chart, because it implies the data exists
// and happens to be zero.

const PLOT_HEIGHT = 150;

const BAND_STYLE: Record<string, { dot: string; text: string }> = {
  threat: { dot: 'bg-error-500', text: 'text-error-700 dark:text-error-500' },
  'cheaper-but-weaker': { dot: 'bg-orange-400', text: 'text-orange-700 dark:text-orange-400' },
  premium: { dot: 'bg-brand-500', text: 'text-brand-600 dark:text-brand-400' },
  'no-advantage': { dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400' },
};

export function CompetitorQualityPanel({
  listings,
  sellerPrice,
  currency,
  perUnit = false,
  className = '',
}: {
  listings: RatedListing[];
  /** Per item, matching whatever normalisation the price panel applied. */
  sellerPrice: number | null;
  currency: string;
  /** Whether prices here are per item, so the labels can say so. */
  perUnit?: boolean;
  className?: string;
}) {
  const analysis = analyseThreats(listings, sellerPrice);

  const money = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(v);

  // No rating coverage: render nothing. This is a property of which sites
  // carry this market - most sellers on this platform will see this
  // section absent, always, because their competitors are single-retailer
  // sites that never report a review score - and repeating that same
  // explanation on every product with no rating data reads as a wall of
  // identical placeholder boxes rather than as useful information. A
  // section that is only ever empty for a given seller is better left out
  // than explained every time.
  if (!analysis.hasEnoughData) return null;

  const { classified, threats, ratingBar, unratedCount } = analysis;

  const prices = classified.map((l) => l.price);
  const ratings = classified.map((l) => l.rating);
  const loPrice = Math.min(...prices, sellerPrice ?? Infinity);
  const hiPrice = Math.max(...prices, sellerPrice ?? -Infinity);
  // Padded so a point never sits on the frame, and never zero-width when
  // every listing happens to share a price or a rating.
  const priceSpan = hiPrice - loPrice || hiPrice || 1;
  const loRating = Math.min(...ratings) - 0.2;
  const hiRating = Math.max(...ratings) + 0.2;
  const ratingSpan = hiRating - loRating || 1;

  const x = (price: number) => ((price - loPrice) / priceSpan) * 100;
  const y = (rating: number) => 100 - ((rating - loRating) / ratingSpan) * 100;

  return (
    <div className={className}>
      {/* The answer, before the picture. */}
      {threats.length > 0 ? (
        <p className="mb-1.5 text-[15px] leading-snug text-gray-900 dark:text-white">
          <span className="text-lg font-semibold text-error-700 dark:text-error-500">
            {threats.length} of {classified.length}
          </span>{' '}
          rated {threats.length === 1 ? 'competitor is' : 'competitors are'} both cheaper than you
          and better reviewed than the rest.
        </p>
      ) : (
        <p className="mb-1.5 text-[15px] leading-snug text-gray-900 dark:text-white">
          <span className="font-semibold text-success-700 dark:text-success-500">
            Nobody here undercuts you with a better-reviewed listing.
          </span>
        </p>
      )}

      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Comparing {classified.length} listing{classified.length === 1 ? '' : 's'} with at least{' '}
        {MIN_CREDIBLE_REVIEWS} reviews. Well reviewed here means {ratingBar.toFixed(1)} or better —
        the middle of this set, not a fixed bar, since ratings inflate differently by category.
        {unratedCount > 0 && ` ${unratedCount} more had no usable rating.`}
      </p>

      <div
        className="relative w-full rounded-lg border border-gray-200 dark:border-gray-800"
        style={{ height: PLOT_HEIGHT }}
        role="img"
        aria-label={`Price against rating for ${classified.length} competitor listings. ${threats.length} are cheaper than you and rated ${ratingBar.toFixed(1)} or better.`}
      >
        {/* The rating bar: above this line is "well reviewed here". */}
        <div
          className="absolute right-0 left-0 border-t border-dashed border-gray-300 dark:border-gray-600"
          style={{ top: `${y(ratingBar)}%` }}
          aria-hidden="true"
        />

        {/* The seller's price. Deliberately a full-height line and not a
            point: seller_products carries no rating, so there is no honest
            y position to put them at. */}
        {sellerPrice != null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-900 dark:bg-white"
            style={{ left: `${x(sellerPrice)}%` }}
            aria-hidden="true"
          >
            <span className="absolute -top-0.5 left-1 rounded bg-gray-900 px-1 text-[10px] font-semibold whitespace-nowrap text-white dark:bg-white dark:text-gray-900">
              your price
            </span>
          </div>
        )}

        {classified.map((l, i) => (
          <span
            key={`${l.url}-${i}`}
            title={`${l.title} — ${money(l.price)}, ${l.rating.toFixed(1)} from ${l.ratingCount} reviews`}
            aria-hidden="true"
            className={`absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-gray-900 ${
              BAND_STYLE[l.band]?.dot ?? 'bg-gray-400'
            }`}
            style={{ left: `${x(l.price)}%`, top: `${y(l.rating)}%` }}
          />
        ))}

        <span className="absolute bottom-1 left-2 text-[10px] text-gray-400 dark:text-gray-500">
          cheaper
        </span>
        <span className="absolute right-2 bottom-1 text-[10px] text-gray-400 dark:text-gray-500">
          dearer{perUnit ? ', per item' : ''}
        </span>
        <span className="absolute top-1 left-2 text-[10px] text-gray-400 dark:text-gray-500">
          better rated
        </span>
      </div>

      {/* Named, because "there are 3 threats" is not actionable and
          "Kaier at PKR 590, 4.7 from 210 reviews" is. */}
      {threats.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {threats.slice(0, 4).map((t, i) => (
            <li key={`${t.url}-${i}`} className="flex items-center gap-2 text-sm">
              <span className={`size-2 shrink-0 rounded-full ${BAND_STYLE.threat.dot}`} aria-hidden="true" />
              <a
                href={t.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-gray-700 hover:text-brand-500 hover:underline dark:text-gray-300"
              >
                {t.title}
              </a>
              <span className="shrink-0 font-semibold text-gray-900 tabular-nums dark:text-white">
                {money(t.price)}
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                <MdOutlineStar className="size-3 text-yellow-400" aria-hidden="true" />
                {t.rating.toFixed(1)}
                <span className="text-gray-400 dark:text-gray-500">({t.ratingCount})</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
        {Object.entries(THREAT_BAND_LABEL)
          .filter(([band]) => classified.some((l) => l.band === band))
          .map(([band, label]) => label)
          .join(' · ')}
      </p>
    </div>
  );
}

export default CompetitorQualityPanel;
