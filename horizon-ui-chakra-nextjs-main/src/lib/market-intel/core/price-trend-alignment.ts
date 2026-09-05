// Aligns the seller's own price history onto the market's daily trend, so
// the two can be drawn as one chart: the seller's line against a shaded
// competitor P25-P75 band, over time.
//
// The alignment problem, not the trend itself, is what this module solves.
// seller_product_price_history is event-sourced - one row per actual price
// change (migration 030's trigger fires on insert and on any change, never
// on a schedule) - while the market trend is one bucket per calendar day
// (migration 021/054). A seller who has not touched their price in three
// weeks has one history row and the market has twenty-one daily buckets;
// plotting the seller series as-is would draw one point on a 21-day axis
// rather than a flat line at their actual, unchanged price.
//
// Forward-filled, not interpolated: a seller's price is whatever they last
// set it to until they change it again - a step function, not a ramp - so
// carrying the last known value forward is the true shape, where drawing a
// line between two distant points would invent prices they never charged.
//
// Pure, so it lives in core/ - see docs/architecture.md.

export type SellerPricePoint = { sellPrice: number | null; recordedAt: string };

export type MarketTrendPoint = {
  date: string;
  medianPrice: number;
  p25: number | null;
  p75: number | null;
};

export type AlignedPricePoint = {
  date: string;
  /**
   * The seller's price as of this date, forward-filled from their last
   * change. Null only for a date before the seller's first ever price
   * point - a product that did not exist yet, not a gap in reporting.
   */
  sellerPrice: number | null;
  marketMedian: number;
  /** Null on a day whose sample was too thin for a band - see migration 054. */
  marketP25: number | null;
  marketP75: number | null;
};

/**
 * Whether `a` (an ISO timestamp) falls on or before the calendar day named
 * by `bucketDate` (a plain date string), in UTC.
 *
 * Compared as calendar days rather than instants because the market side is
 * already bucketed to a day - a seller price change recorded at 23:59 on a
 * bucket's date is effective for that whole bucket, not held back to the
 * next one on a timezone technicality.
 */
function onOrBefore(recordedAt: string, bucketDate: string): boolean {
  const recordedDay = recordedAt.slice(0, 10);
  return recordedDay <= bucketDate;
}

export function alignSellerPriceToMarketTrend(
  sellerHistory: SellerPricePoint[],
  marketTrend: MarketTrendPoint[],
): AlignedPricePoint[] {
  // Ascending by time, defensively - the caller's query already orders this
  // way, but forward-fill silently produces the wrong answer on unsorted
  // input rather than an error, so it is worth not trusting the order.
  const history = [...sellerHistory].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

  let cursor = 0;
  let current: number | null = null;

  return marketTrend.map((point) => {
    // Advance the cursor through every seller change that had taken effect
    // by this bucket's date. Never rewinds: marketTrend is itself ascending
    // by date, so each bucket only ever needs to look further forward
    // through history than the last one did - an O(n+m) walk rather than a
    // re-scan per bucket.
    while (cursor < history.length && onOrBefore(history[cursor].recordedAt, point.date)) {
      current = history[cursor].sellPrice;
      cursor += 1;
    }

    return {
      date: point.date,
      sellerPrice: current,
      marketMedian: point.medianPrice,
      marketP25: point.p25,
      marketP75: point.p75,
    };
  });
}

export type PriceVsMarketSummary = {
  /** Days where the seller's price sat above the market's P75. */
  daysAbove: number;
  /** Days where the seller's price sat below the market's P25. */
  daysBelow: number;
  /** Days inside the band - neither undercutting nor overpriced. */
  daysInside: number;
  /** Denominator: days where BOTH a seller price and a band existed. */
  daysWithBand: number;
  /** Where the most recent comparable day landed. Null with no comparable day at all. */
  currentPosition: 'above' | 'below' | 'inside' | null;
};

/**
 * Counts how many days the seller spent above, below, or inside the
 * market's band - the sentence a chart of thirty points should not make a
 * reader compute for themselves.
 *
 * Only days carrying BOTH a seller price and a band count toward
 * daysWithBand. A day before the product existed, or a day too thin for
 * migration 054's band threshold, is excluded rather than guessed at -
 * counted as "inside" by default would quietly understate how often the
 * seller is actually outside the market.
 */
export function summarisePriceVsMarket(points: AlignedPricePoint[]): PriceVsMarketSummary {
  let daysAbove = 0;
  let daysBelow = 0;
  let daysInside = 0;
  let currentPosition: PriceVsMarketSummary['currentPosition'] = null;

  for (const point of points) {
    if (point.sellerPrice == null || point.marketP25 == null || point.marketP75 == null) continue;

    const position: NonNullable<PriceVsMarketSummary['currentPosition']> =
      point.sellerPrice > point.marketP75 ? 'above' : point.sellerPrice < point.marketP25 ? 'below' : 'inside';

    if (position === 'above') daysAbove += 1;
    else if (position === 'below') daysBelow += 1;
    else daysInside += 1;

    // Points are date-ascending, so the last one assigned here is the most
    // recent comparable day - overwriting on every match is what makes
    // this "current" rather than "first".
    currentPosition = position;
  }

  return { daysAbove, daysBelow, daysInside, daysWithBand: daysAbove + daysBelow + daysInside, currentPosition };
}
