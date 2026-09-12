// How long a competitor listing has actually been out of stock, and
// whether that is a confirmed fact or a floor.
//
// market_products.last_seen_at answers "how fresh is this row", not "how
// long has it been out" - it is bumped on every scrape regardless of stock
// status, so a listing that went out an hour ago and one that has been out
// for three weeks are indistinguishable on it. The stock-out list exists to
// answer "pick up the slack while they can't fulfil", which needs duration,
// not freshness.
//
// The distinction this module insists on: `confirmed: true` means we have
// an actual observation of the product in stock, and the gap is measured
// from there. `confirmed: false` means we have NEVER seen it in stock
// across our recorded history - which is a floor ("out for at least this
// long"), not a transition we witnessed. We may simply not have scraped it
// while it was still in stock. Collapsing the two into one number would
// let a genuinely long-standing gap and "we started tracking this
// yesterday" look identical.
//
// Pure, so it lives in core/ - see docs/architecture.md.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type StockOutDuration = {
  days: number;
  /** True when `days` is measured from an observed in-stock moment, not a floor. */
  confirmed: boolean;
};

/**
 * @param lastConfirmedInStockAt The most recent observation where in_stock
 *   was true, from market_stock_out_durations (migration 055). Null if the
 *   product has never been seen in stock in our history.
 * @param earliestObservedAt The earliest observation we have for this
 *   product at all, used as the floor when there is no confirmed moment.
 */
export function computeStockOutDuration(
  lastConfirmedInStockAt: string | null,
  earliestObservedAt: string | null,
  now: Date = new Date(),
): StockOutDuration | null {
  const anchor = lastConfirmedInStockAt ?? earliestObservedAt;
  if (!anchor) return null;

  const days = Math.max(0, Math.floor((now.getTime() - new Date(anchor).getTime()) / MS_PER_DAY));
  return { days, confirmed: lastConfirmedInStockAt != null };
}

export type StockOutUrgency = 'fresh' | 'notable' | 'extended';

/**
 * Below 3 days is within the scraper's own 2-day cadence's noise - a
 * listing observed out-of-stock once could just be between restocks.
 * 14+ days is long enough, at that same cadence, that it has survived
 * several independent looks and reads as a real, standing gap rather than
 * a blip - the case worth a seller's attention first.
 */
export function classifyStockOutUrgency(days: number): StockOutUrgency {
  if (days >= 14) return 'extended';
  if (days >= 3) return 'notable';
  return 'fresh';
}

/**
 * The sentence a duration badge stands in for. Kept as one function rather
 * than left to each caller, so "confirmed" versus "at least" phrasing is
 * never a choice a component author has to remember to get right.
 */
export function formatStockOutDuration(duration: StockOutDuration): string {
  const { days, confirmed } = duration;

  if (days === 0) return confirmed ? 'Out since today' : 'Out - first seen today';

  const unit = days === 1 ? 'day' : 'days';
  return confirmed ? `Out ${days} ${unit}` : `Out ${days}+ ${unit}`;
}
