import { describe, it, expect } from 'vitest';

import {
  alignSellerPriceToMarketTrend,
  summarisePriceVsMarket,
  type MarketTrendPoint,
  type SellerPricePoint,
} from './price-trend-alignment';

function trendPoint(date: string, overrides: Partial<MarketTrendPoint> = {}): MarketTrendPoint {
  return { date, medianPrice: 1000, p25: 900, p75: 1100, ...overrides };
}

describe('alignSellerPriceToMarketTrend', () => {
  it('forward-fills a single seller price across every market bucket', () => {
    // A seller who has not touched their price is one history row against
    // twenty-one daily buckets - the whole reason this module exists.
    const history: SellerPricePoint[] = [{ sellPrice: 500, recordedAt: '2026-08-01T10:00:00Z' }];
    const trend = ['2026-08-01', '2026-08-05', '2026-08-10'].map((d) => trendPoint(d));

    const aligned = alignSellerPriceToMarketTrend(history, trend);

    expect(aligned.map((a) => a.sellerPrice)).toEqual([500, 500, 500]);
  });

  it('steps to the new price exactly on the day it changed, not before', () => {
    const history: SellerPricePoint[] = [
      { sellPrice: 500, recordedAt: '2026-08-01T10:00:00Z' },
      { sellPrice: 600, recordedAt: '2026-08-05T10:00:00Z' },
    ];
    const trend = ['2026-08-04', '2026-08-05', '2026-08-06'].map((d) => trendPoint(d));

    const aligned = alignSellerPriceToMarketTrend(history, trend);

    expect(aligned.map((a) => a.sellerPrice)).toEqual([500, 600, 600]);
  });

  it('holds the last price through several unchanged buckets, then steps again', () => {
    const history: SellerPricePoint[] = [
      { sellPrice: 500, recordedAt: '2026-08-01T00:00:00Z' },
      { sellPrice: 600, recordedAt: '2026-08-10T00:00:00Z' },
      { sellPrice: 550, recordedAt: '2026-08-20T00:00:00Z' },
    ];
    const trend = ['2026-08-05', '2026-08-09', '2026-08-10', '2026-08-15', '2026-08-20', '2026-08-25'].map(
      (d) => trendPoint(d),
    );

    const aligned = alignSellerPriceToMarketTrend(history, trend);

    expect(aligned.map((a) => a.sellerPrice)).toEqual([500, 500, 600, 600, 550, 550]);
  });

  it('is null before the product existed, not backfilled from a later price', () => {
    // The product was created on the 10th - dates before that are not "no
    // data", they are "did not exist", and inventing a price for them
    // would be worse than leaving the gap visible.
    const history: SellerPricePoint[] = [{ sellPrice: 500, recordedAt: '2026-08-10T00:00:00Z' }];
    const trend = ['2026-08-01', '2026-08-05', '2026-08-10', '2026-08-15'].map((d) => trendPoint(d));

    const aligned = alignSellerPriceToMarketTrend(history, trend);

    expect(aligned.map((a) => a.sellerPrice)).toEqual([null, null, 500, 500]);
  });

  it('returns every bucket as null for a product with no price history at all', () => {
    const trend = ['2026-08-01', '2026-08-05'].map((d) => trendPoint(d));
    expect(alignSellerPriceToMarketTrend([], trend).map((a) => a.sellerPrice)).toEqual([null, null]);
  });

  it('carries the market median and band through unchanged, per bucket', () => {
    const history: SellerPricePoint[] = [{ sellPrice: 500, recordedAt: '2026-08-01T00:00:00Z' }];
    const trend = [
      trendPoint('2026-08-01', { medianPrice: 1000, p25: 900, p75: 1100 }),
      // A thin day: migration 054 withholds p25/p75 but still reports a median.
      trendPoint('2026-08-02', { medianPrice: 950, p25: null, p75: null }),
    ];

    const aligned = alignSellerPriceToMarketTrend(history, trend);

    expect(aligned[0]).toEqual({ date: '2026-08-01', sellerPrice: 500, marketMedian: 1000, marketP25: 900, marketP75: 1100 });
    expect(aligned[1]).toMatchObject({ marketMedian: 950, marketP25: null, marketP75: null });
  });

  it('does not require the seller history to arrive pre-sorted', () => {
    const history: SellerPricePoint[] = [
      { sellPrice: 600, recordedAt: '2026-08-10T00:00:00Z' },
      { sellPrice: 500, recordedAt: '2026-08-01T00:00:00Z' },
    ];
    const trend = ['2026-08-05', '2026-08-15'].map((d) => trendPoint(d));

    expect(alignSellerPriceToMarketTrend(history, trend).map((a) => a.sellerPrice)).toEqual([500, 600]);
  });

  it('treats a price change recorded on the bucket day itself as already effective', () => {
    const history: SellerPricePoint[] = [
      { sellPrice: 500, recordedAt: '2026-08-01T00:00:00Z' },
      { sellPrice: 600, recordedAt: '2026-08-05T23:59:59Z' },
    ];
    const trend = [trendPoint('2026-08-05')];

    expect(alignSellerPriceToMarketTrend(history, trend)[0].sellerPrice).toBe(600);
  });

  it('returns an empty array for an empty trend', () => {
    expect(alignSellerPriceToMarketTrend([{ sellPrice: 500, recordedAt: '2026-08-01T00:00:00Z' }], [])).toEqual([]);
  });
});

describe('summarisePriceVsMarket', () => {
  function point(sellerPrice: number | null, p25: number | null, p75: number | null, date = '2026-08-01') {
    return { date, sellerPrice, marketMedian: 1000, marketP25: p25, marketP75: p75 };
  }

  it('counts a day above the band as above, not merely above the median', () => {
    const result = summarisePriceVsMarket([point(1200, 900, 1100)]);
    expect(result.daysAbove).toBe(1);
    expect(result.daysWithBand).toBe(1);
  });

  it('counts a day below P25 as below', () => {
    const result = summarisePriceVsMarket([point(800, 900, 1100)]);
    expect(result.daysBelow).toBe(1);
  });

  it('counts a day between P25 and P75 as inside', () => {
    const result = summarisePriceVsMarket([point(1000, 900, 1100)]);
    expect(result.daysInside).toBe(1);
  });

  it('excludes a day with no seller price from the denominator', () => {
    const result = summarisePriceVsMarket([point(null, 900, 1100)]);
    expect(result.daysWithBand).toBe(0);
  });

  it('excludes a thin day (no band) from the denominator rather than counting it as inside', () => {
    // A day migration 054 withheld the band for must not quietly read as
    // "priced fine" - it is unknown, not inside.
    const result = summarisePriceVsMarket([point(1000, null, null)]);
    expect(result.daysWithBand).toBe(0);
    expect(result.daysInside).toBe(0);
  });

  it('reports the most recent comparable day as the current position, not the first', () => {
    const result = summarisePriceVsMarket([
      point(1200, 900, 1100, '2026-08-01'), // above
      point(1000, 900, 1100, '2026-08-02'), // inside
    ]);
    expect(result.currentPosition).toBe('inside');
  });

  it('skips past a trailing thin day to find the last real comparable one', () => {
    const result = summarisePriceVsMarket([
      point(1200, 900, 1100, '2026-08-01'), // above
      point(1000, null, null, '2026-08-02'), // no band - skipped
    ]);
    expect(result.currentPosition).toBe('above');
  });

  it('returns null current position when nothing is comparable', () => {
    expect(summarisePriceVsMarket([point(null, null, null)]).currentPosition).toBeNull();
  });

  it('handles an empty series', () => {
    const result = summarisePriceVsMarket([]);
    expect(result).toEqual({ daysAbove: 0, daysBelow: 0, daysInside: 0, daysWithBand: 0, currentPosition: null });
  });
});
