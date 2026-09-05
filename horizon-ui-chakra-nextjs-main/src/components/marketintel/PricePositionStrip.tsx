'use client';

// Where the seller sits in a set of competitor prices.
//
// This started as a dot plot on a price axis and that was the wrong form.
// Unlabelled dots make the reader decode a position into a price by
// interpolating between the two end labels, and a sparse row of identical
// marks says nothing about where competition actually concentrates. It
// looked like a chart without answering anything.
//
// Labelled price bands with counts instead. Every row is a sentence a
// person can read - "PKR 3,000-6,000: 5 listings" - and the bar lengths
// give the shape for free. Same pattern as the Competitors page's
// assortment concentration panel, so the app has one way of showing a
// distribution rather than two.

type Listing = {
  price: number | null;
  /** Items in this listing. Defaults to 1 when the caller cannot say. */
  unitCount?: number;
};

/** Target number of bands. Few enough to read at a glance, enough for shape. */
const TARGET_BANDS = 5;

/**
 * A round step covering the range in roughly TARGET_BANDS steps.
 *
 * Round numbers, not equal divisions of the actual range: "PKR 3,000-6,000"
 * is a band a person can place a price into instantly, where an honest
 * "PKR 3,180-5,260" makes them do arithmetic to use it.
 */
function niceStep(range: number): number {
  const rough = range / TARGET_BANDS;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalised = rough / magnitude;
  // 1, 2, 2.5, 5, 10 - the steps that produce round band edges.
  const nice = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return nice * magnitude;
}

export function PricePositionStrip({
  listings,
  sellerPrice,
  sellerUnitCount,
  currency,
  className = '',
}: {
  listings: Listing[];
  /** The seller's own price. Null hides the marker and the verdict. */
  sellerPrice: number | null;
  /** Items in the seller's own product. */
  sellerUnitCount?: number;
  currency: string;
  className?: string;
}) {
  // Compare per item, not per listing, whenever the set is not all one pack
  // size. A 3-pack against fifteen singles is not like-for-like, and
  // reporting the raw gap produced a confident "164% above the median" that
  // was wrong by a factor of three.
  //
  // Applied only when sizes actually differ, so the ordinary case - all
  // single items - is untouched and the figures stay the prices a buyer
  // would actually pay.
  const sellerUnits = Math.max(1, sellerUnitCount ?? 1);
  const packSizes = new Set([...listings.map((l) => Math.max(1, l.unitCount ?? 1)), sellerUnits]);
  const perUnit = packSizes.size > 1;

  const prices = listings
    .map((l) => (l.price == null ? null : perUnit ? l.price / Math.max(1, l.unitCount ?? 1) : l.price))
    .filter((p): p is number => p != null && Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);

  const comparablePrice =
    sellerPrice == null ? null : perUnit ? sellerPrice / sellerUnits : sellerPrice;

  // Two prices are not a distribution; bands over them would imply a shape
  // that isn't there.
  if (prices.length < 3) return null;

  const median = prices[Math.floor(prices.length / 2)];
  const cheapest = prices[0];
  const dearest = prices[prices.length - 1];

  const step = niceStep(dearest - cheapest || cheapest || 1);
  const start = Math.floor(cheapest / step) * step;
  const end = Math.ceil((dearest + 1) / step) * step;

  const bands: { from: number; to: number; count: number }[] = [];
  for (let from = start; from < end; from += step) {
    const to = from + step;
    bands.push({
      from,
      to,
      // Upper-exclusive, except the last band which has to include the
      // dearest listing or it vanishes from its own chart.
      count: prices.filter((p) => p >= from && (to >= end ? p <= to : p < to)).length,
    });
  }

  const busiest = Math.max(...bands.map((b) => b.count), 1);
  const sellerBand =
    comparablePrice != null
      ? bands.findIndex((b) => comparablePrice >= b.from && comparablePrice < b.to)
      : -1;

  // The pack: the densest band, and the real spread of the listings inside
  // it. Named explicitly because concentration is the normal case - on the
  // data this was tuned against, 13 of 15 listings sat in one band - and
  // making a reader infer "most of them are here" from bar lengths is the
  // slowest part of reading a distribution.
  const packIndex = bands.reduce((best, b, i) => (b.count > bands[best].count ? i : best), 0);
  const pack = bands[packIndex];
  const packPrices = prices.filter((p) => p >= pack.from && p < pack.to);
  const packIsMajority = pack.count / prices.length >= 0.5;

  // Empty bands are half the rows on a concentrated distribution and carry
  // nothing. Dropped, except the seller's own - "no competitors in your
  // band" is itself a finding. A gap marker keeps the remaining rows from
  // implying an adjacency that isn't there.
  const visibleBands = bands
    .map((band, index) => ({ ...band, index }))
    .filter((band) => band.count > 0 || band.index === sellerBand);

  const dearerThanSeller =
    comparablePrice != null ? prices.filter((p) => p > comparablePrice).length : 0;
  const atMarket =
    comparablePrice != null && median > 0 && Math.abs((comparablePrice - median) / median) < 0.05;
  const isCheaper = comparablePrice != null && comparablePrice < median;
  const vsMedianPct =
    comparablePrice != null && median > 0 ? ((comparablePrice - median) / median) * 100 : 0;

  // The next listing above the seller. This is the actionable number on the
  // whole panel: it is how much room there is to raise a price before
  // anyone else becomes the cheaper option.
  const nextUp = comparablePrice != null ? prices.find((p) => p > comparablePrice) ?? null : null;

  const money = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      notation: v >= 1_000_000 ? 'compact' : 'standard',
    }).format(v);

  const verdictText = atMarket
    ? 'text-gray-700 dark:text-gray-200'
    : isCheaper
      ? 'text-success-700 dark:text-success-500'
      : 'text-error-700 dark:text-error-500';

  return (
    <div className={className}>
      {/* The three figures a seller compares, side by side and large enough
          to read without hunting. Their own price first: it is the one they
          came here to judge. */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          {
            label: perUnit ? 'Your price, per item' : 'Your price',
            value: comparablePrice,
            emphasis: true,
          },
          {
            label: perUnit ? 'Median, per item' : 'Market median',
            value: median,
            emphasis: false,
          },
          {
            label: perUnit ? 'Cheapest, per item' : 'Cheapest here',
            value: cheapest,
            emphasis: false,
          },
        ].map((stat) => (
          <div key={stat.label}>
            <p className="text-[11px] tracking-wide text-gray-500 uppercase dark:text-gray-400">
              {stat.label}
            </p>
            <p
              className={`text-lg font-semibold tabular-nums ${
                stat.emphasis ? verdictText : 'text-gray-900 dark:text-white'
              }`}
            >
              {stat.value != null ? money(stat.value) : '—'}
            </p>
          </div>
        ))}
      </div>

      {comparablePrice != null && (
        <>
          {/* The one-line answer, sized so it is read before anything else
              on the panel. */}
          <p className="mb-1.5 text-[15px] leading-snug text-gray-900 dark:text-white">
            {atMarket ? (
              <>
                You are priced <span className="font-semibold">at the market median</span>.
              </>
            ) : (
              <>
                You are{' '}
                <span className={`text-lg font-semibold ${verdictText}`}>
                  {Math.abs(vsMedianPct).toFixed(0)}% {isCheaper ? 'below' : 'above'}
                </span>{' '}
                the median, and only {dearerThanSeller} of {prices.length}{' '}
                {dearerThanSeller === 1 ? 'listing costs' : 'listings cost'} more than you.
              </>
            )}
          </p>

          {/* Where the competition actually is. On a concentrated market
              this is the sentence that does the work. */}
          {packIsMajority && packPrices.length > 1 && (
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              {pack.count} of {prices.length} listings are packed between{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {money(packPrices[0])}
              </span>{' '}
              and{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {money(packPrices[packPrices.length - 1])}
              </span>
              .
            </p>
          )}
        </>
      )}

      {perUnit && (
        <p className="mb-3 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:bg-gray-800 dark:text-orange-400">
          These listings are not all the same pack size, so every figure here
          is <span className="font-semibold">per item</span> — otherwise a
          multipack would look far dearer than the singles it is matched
          against.
        </p>
      )}

      <p className="mb-2 text-[11px] tracking-wide text-gray-500 uppercase dark:text-gray-400">
        How the {prices.length} listings are priced{perUnit ? ', per item' : ''}
      </p>

      <div className="flex flex-col gap-1.5">
        {visibleBands.map((band, i) => {
          const isSellerBand = band.index === sellerBand;
          const isPack = band.index === packIndex && band.count > 0;
          // Bands were skipped between this row and the previous one, so the
          // two are not actually adjacent on the price axis. Said out loud -
          // silently closing the gap would misrepresent the spread.
          const skipped = i > 0 ? band.index - visibleBands[i - 1].index - 1 : 0;

          return (
            <div key={band.from}>
              {skipped > 0 && (
                <p className="py-0.5 pl-[144px] text-[11px] text-gray-400 dark:text-gray-500">
                  nothing priced between
                </p>
              )}

              <div className="flex items-center gap-3">
                <span
                  className={`w-[132px] shrink-0 text-right text-xs tabular-nums ${
                    isPack
                      ? 'font-semibold text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {money(band.from)}–{money(band.to)}
                </span>

                <span className="relative h-5 min-w-0 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                  <span
                    className={`block h-full rounded ${
                      isSellerBand
                        ? 'bg-brand-500'
                        : isPack
                          ? 'bg-gray-400 dark:bg-gray-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    style={{ width: band.count === 0 ? 0 : `${(band.count / busiest) * 100}%` }}
                  />
                </span>

                <span className="flex w-[104px] shrink-0 items-center gap-1.5 text-xs text-gray-600 tabular-nums dark:text-gray-300">
                  {band.count > 0 && (
                    <span className={isPack ? 'font-semibold text-gray-900 dark:text-white' : ''}>
                      {band.count}
                    </span>
                  )}
                  {isSellerBand && (
                    <span className="rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      you
                    </span>
                  )}
                  {/* An empty band the seller is alone in is not a blank
                      row - being isolated above the market is the finding. */}
                  {isSellerBand && band.count === 0 && (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">only you</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* The one number that turns this from a description into a decision. */}
      {nextUp != null && comparablePrice != null && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          The next listing above you is{' '}
          <span className="font-semibold text-gray-900 dark:text-white">{money(nextUp)}</span> —{' '}
          {money(nextUp - comparablePrice)} of headroom before you stop being the cheaper option.
        </p>
      )}
      {nextUp == null && comparablePrice != null && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Nothing here is priced above you — you are the most expensive of the {prices.length}.
        </p>
      )}
    </div>
  );
}

export default PricePositionStrip;
