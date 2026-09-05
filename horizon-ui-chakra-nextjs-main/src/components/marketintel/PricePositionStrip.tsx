'use client';

// Where the seller sits in a set of competitor prices, as one picture.
//
// The Competitors drawer is a table of 15 rows: readable one line at a
// time, and useless for the question a seller actually opens it to answer -
// "am I cheap or expensive here?" Answering that from a table means holding
// fifteen numbers in your head and finding your own among them. A dot per
// listing on a shared price axis answers it before you have read anything.
//
// A dot plot rather than a bar chart because the data is one dimensional -
// a set of prices - and bars would invent a second axis that means nothing.
// Overlapping prices stack vertically, so a cluster reads as a cluster
// rather than as one dot hiding four others.
//
// Drawn with positioned elements instead of a chart library. The whole
// thing is ~30 marks on a linear scale; ApexCharts would be several hundred
// kB and a wrapper to fight for a picture this simple.

type Listing = {
  price: number | null;
  matchStrength?: 'strong' | 'likely' | 'loose';
};

/** Dot columns across the width. More bins = finer positions, taller stacks. */
const BIN_COUNT = 34;
const DOT = 9;
const STACK_GAP = 2;
/** Floor for the plot, so a flat distribution still reads as a strip. */
const MIN_PLOT_HEIGHT = 68;
/** Ceiling, so one pathological cluster cannot push the table off screen. */
const MAX_PLOT_HEIGHT = 132;

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

  // One price and one seller is not a distribution - a strip drawn over it
  // would imply a spread that isn't there.
  if (prices.length < 2) return null;

  const median = prices[Math.floor(prices.length / 2)];

  // The axis spans every mark it has to show, so the seller's own price can
  // never fall outside the drawing when they are the cheapest or dearest.
  const lo = Math.min(prices[0], sellerPrice ?? Infinity);
  const hi = Math.max(prices[prices.length - 1], sellerPrice ?? -Infinity);
  const span = hi - lo || 1;
  const pct = (value: number) => ((value - lo) / span) * 100;

  // Bin, then stack within the bin. Positions come from the bin's centre
  // rather than the raw price so a stack sits as one column instead of a
  // ragged diagonal.
  const bins = new Map<number, { price: number; strength?: Listing['matchStrength'] }[]>();
  for (const listing of listings) {
    const price = listing.price;
    if (price == null || !Number.isFinite(price) || price <= 0) continue;
    const bin = Math.min(BIN_COUNT - 1, Math.floor(((price - lo) / span) * BIN_COUNT));
    const column = bins.get(bin) ?? [];
    column.push({ price, strength: listing.matchStrength });
    bins.set(bin, column);
  }

  // Height follows the tallest stack rather than being fixed. Commodity
  // goods cluster hard on price - fifteen listings within a few hundred
  // rupees is normal - and a fixed height would silently clip the top of
  // that column, which is exactly the case a seller most needs to see.
  const tallestStack = Math.max(...[...bins.values()].map((c) => c.length), 1);
  const neededHeight = 1 + (tallestStack - 1) * (DOT + STACK_GAP) + DOT + 14;
  const plotHeight = Math.min(MAX_PLOT_HEIGHT, Math.max(MIN_PLOT_HEIGHT, neededHeight));
  // Past the ceiling, a column is truncated and says so rather than
  // overflowing into the median label.
  const maxVisiblePerColumn = Math.floor((plotHeight - 14 - DOT) / (DOT + STACK_GAP)) + 1;

  const cheaperThan = sellerPrice != null ? prices.filter((p) => p > sellerPrice).length : 0;
  const isCheaper = sellerPrice != null && sellerPrice < median;
  const atMarket =
    sellerPrice != null && median > 0 && Math.abs((sellerPrice - median) / median) < 0.05;

  const money = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      notation: v >= 100000 ? 'compact' : 'standard',
    }).format(v);

  // Semantic, matching the drawer's own vs-yours column: cheaper is good
  // for the seller, dearer is the thing to look at.
  const markerColor = atMarket
    ? 'bg-gray-500 dark:bg-gray-400'
    : isCheaper
      ? 'bg-success-600 dark:bg-success-500'
      : 'bg-error-600 dark:bg-error-500';
  const markerText = atMarket
    ? 'text-gray-600 dark:text-gray-300'
    : isCheaper
      ? 'text-success-700 dark:text-success-500'
      : 'text-error-700 dark:text-error-500';

  return (
    <div className={className}>
      {sellerPrice != null && (
        <p className="mb-2 text-sm text-gray-700 dark:text-gray-200">
          At <span className="font-semibold">{money(sellerPrice)}</span> you are{' '}
          <span className={`font-semibold ${markerText}`}>
            {atMarket
              ? 'priced at the market median'
              : `cheaper than ${cheaperThan} of ${prices.length} listings`}
          </span>
          {!atMarket && <span className="text-gray-500 dark:text-gray-400"> here</span>}.
        </p>
      )}

      <div
        className="relative w-full"
        style={{ height: plotHeight }}
        role="img"
        aria-label={
          sellerPrice != null
            ? `Price distribution of ${prices.length} competitor listings from ${money(prices[0])} to ${money(prices[prices.length - 1])}, median ${money(median)}. Your price is ${money(sellerPrice)}, cheaper than ${cheaperThan} of them.`
            : `Price distribution of ${prices.length} competitor listings from ${money(prices[0])} to ${money(prices[prices.length - 1])}, median ${money(median)}.`
        }
      >
        {/* Median first, so dots and the seller marker sit over it. */}
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-600"
          style={{ left: `${pct(median)}%` }}
          aria-hidden="true"
        />
        <span
          className="absolute top-0 -translate-x-1/2 text-[10px] whitespace-nowrap text-gray-400 dark:text-gray-500"
          style={{ left: `${pct(median)}%` }}
          aria-hidden="true"
        >
          median
        </span>

        {/* Baseline the dots sit on. */}
        <div
          className="absolute right-0 left-0 h-px bg-gray-200 dark:bg-gray-700"
          style={{ bottom: 0 }}
          aria-hidden="true"
        />

        {[...bins.entries()].map(([bin, column]) => {
          const shown = column.slice(0, maxVisiblePerColumn);
          const hidden = column.length - shown.length;
          const left = `${((bin + 0.5) / BIN_COUNT) * 100}%`;
          return (
            <span key={bin}>
              {shown.map((item, i) => (
                <span
                  key={i}
                  title={money(item.price)}
                  aria-hidden="true"
                  className={`absolute rounded-full ${
                    // A loose match is a weaker claim that this is even the
                    // same product, so it reads as a fainter dot rather than
                    // carrying the same weight as a strong one.
                    item.strength === 'loose'
                      ? 'bg-brand-300 dark:bg-brand-500/50'
                      : 'bg-brand-500 dark:bg-brand-400'
                  }`}
                  style={{
                    width: DOT,
                    height: DOT,
                    left,
                    bottom: 1 + i * (DOT + STACK_GAP),
                    transform: 'translateX(-50%)',
                  }}
                />
              ))}
              {hidden > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -translate-x-1/2 text-[9px] font-semibold text-brand-500 dark:text-brand-400"
                  style={{ left, bottom: 1 + shown.length * (DOT + STACK_GAP) }}
                >
                  +{hidden}
                </span>
              )}
            </span>
          );
        })}

        {/* The seller's own price: a full-height rule, so it reads as a
            position on the axis rather than as one more competitor dot. */}
        {sellerPrice != null && (
          <div
            className="absolute top-3 bottom-0"
            style={{ left: `${pct(sellerPrice)}%` }}
            aria-hidden="true"
          >
            <div className={`h-full w-0.5 -translate-x-1/2 ${markerColor}`} />
            <span
              className={`absolute -top-3 left-0 -translate-x-1/2 rounded px-1 text-[10px] font-semibold whitespace-nowrap text-white ${markerColor}`}
            >
              you
            </span>
          </div>
        )}
      </div>

      <div className="mt-1 flex justify-between text-[11px] text-gray-500 tabular-nums dark:text-gray-400">
        <span>{money(prices[0])}</span>
        <span>{money(prices[prices.length - 1])}</span>
      </div>
    </div>
  );
}

export default PricePositionStrip;
