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
  currency,
  className = '',
}: {
  listings: Listing[];
  /** The seller's own price. Null hides the marker and the verdict. */
  sellerPrice: number | null;
  currency: string;
  className?: string;
}) {
  const prices = listings
    .map((l) => l.price)
    .filter((p): p is number => p != null && Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);

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
    sellerPrice != null ? bands.findIndex((b) => sellerPrice >= b.from && sellerPrice < b.to) : -1;

  const dearerThanSeller = sellerPrice != null ? prices.filter((p) => p > sellerPrice).length : 0;
  const atMarket =
    sellerPrice != null && median > 0 && Math.abs((sellerPrice - median) / median) < 0.05;
  const isCheaper = sellerPrice != null && sellerPrice < median;
  const vsMedianPct = sellerPrice != null && median > 0 ? ((sellerPrice - median) / median) * 100 : 0;

  // The next listing above the seller. This is the actionable number on the
  // whole panel: it is how much room there is to raise a price before
  // anyone else becomes the cheaper option.
  const nextUp = sellerPrice != null ? prices.find((p) => p > sellerPrice) ?? null : null;

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
          { label: 'Your price', value: sellerPrice, emphasis: true },
          { label: 'Market median', value: median, emphasis: false },
          { label: 'Cheapest here', value: cheapest, emphasis: false },
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

      {sellerPrice != null && (
        <p className="mb-3 text-sm text-gray-700 dark:text-gray-200">
          {atMarket ? (
            <>
              You are priced <span className="font-semibold">at the market median</span>.
            </>
          ) : (
            <>
              You are{' '}
              <span className={`font-semibold ${verdictText}`}>
                {Math.abs(vsMedianPct).toFixed(0)}% {isCheaper ? 'below' : 'above'} the median
              </span>
              , and {dearerThanSeller} of {prices.length} listings cost more than you.
            </>
          )}
        </p>
      )}

      <p className="mb-2 text-[11px] tracking-wide text-gray-500 uppercase dark:text-gray-400">
        How the {prices.length} listings are priced
      </p>

      <div className="flex flex-col gap-1.5">
        {bands.map((band, i) => {
          const isSellerBand = i === sellerBand;
          return (
            <div key={band.from} className="flex items-center gap-3">
              <span className="w-[132px] shrink-0 text-right text-xs text-gray-600 tabular-nums dark:text-gray-300">
                {money(band.from)}–{money(band.to)}
              </span>

              <span className="relative h-5 min-w-0 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                <span
                  className={`block h-full rounded ${
                    isSellerBand ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  // Always a sliver for an empty band, so the row still
                  // reads as a row rather than a gap in the list.
                  style={{ width: band.count === 0 ? 2 : `${(band.count / busiest) * 100}%` }}
                />
              </span>

              <span className="w-[92px] shrink-0 text-xs text-gray-600 tabular-nums dark:text-gray-300">
                {band.count === 0 ? (
                  <span className="text-gray-400 dark:text-gray-500">none</span>
                ) : (
                  `${band.count} listing${band.count === 1 ? '' : 's'}`
                )}
                {isSellerBand && (
                  <span className="ml-1.5 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    you
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* The one number that turns this from a description into a decision. */}
      {nextUp != null && sellerPrice != null && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          The next listing above you is{' '}
          <span className="font-semibold text-gray-900 dark:text-white">{money(nextUp)}</span> —{' '}
          {money(nextUp - sellerPrice)} of headroom before you stop being the cheaper option.
        </p>
      )}
      {nextUp == null && sellerPrice != null && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Nothing here is priced above you — you are the most expensive of the {prices.length}.
        </p>
      )}
    </div>
  );
}

export default PricePositionStrip;
