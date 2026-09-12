import { describe, it, expect, beforeEach, vi } from 'vitest';

// Persistence-gate coverage for ANOMALY_CONFIRMATION_CYCLES (=2): an
// anomaly must hold across today's evaluation AND the evaluation one cycle
// prior before it's surfaced. This is what stops a single glitchy scrape
// (bad price parse, one-off data-entry error) from immediately becoming a
// user-facing flag - see anomalies.ts's module comment for the full
// rationale. The un-gated `compute*` helpers are exported for these tests
// specifically so the underlying z-score/IQR math can be asserted
// unchanged, independent of the new gating behavior.

let orderRows: { order_date: string; total_amount: number; currency: string }[] = [];
let fxRows: { quote_currency: string; rate: number; rate_date: string }[] = [];
let productRows: any[] = [];
let baselineRowsByCycle: Record<number, { product_id: string; baseline_price: number }[]> = {};
let rpcCallCount = 0;

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (fn: string, _params: any): Promise<{ data: any[]; error: null }> => {
      if (fn !== 'market_scope_price_baseline') throw new Error(`unexpected rpc ${fn}`);
      const cycle = rpcCallCount;
      rpcCallCount += 1;
      return { data: baselineRowsByCycle[cycle] ?? [], error: null };
    },
    from: (table: string) => {
      if (table === 'seller_orders') {
        return {
          select: () => ({
            eq: () => ({
              gte: async (): Promise<{ data: typeof orderRows; error: null }> => ({ data: orderRows, error: null }),
            }),
          }),
        };
      }
      if (table === 'fx_rates') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async (): Promise<{ data: typeof fxRows; error: null }> => ({ data: fxRows, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'market_products') {
        return {
          select: () => ({
            eq: () => ({
              not: () => ({
                in: () => ({
                  in: async (): Promise<{ data: any[]; error: null }> => ({ data: productRows, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock('@/lib/market-intel/market/market-definition', () => ({
  getMarketScope: async () => ({ categorySlugs: ['gpus'], activePlatformIds: ['p1'] }),
}));

import {
  detectOwnRevenueAnomalies,
  detectCompetitorPriceAnomalies,
  ANOMALY_CONFIRMATION_CYCLES,
  computeRevenueAnomaliesFromSeries,
  iqrOutlierIds,
  computePctChanges,
} from './anomalies';

beforeEach(() => {
  orderRows = [];
  fxRows = [];
  productRows = [];
  baselineRowsByCycle = {};
  rpcCallCount = 0;
});

function revenueRow(date: string, amount: number) {
  return { order_date: `${date}T00:00:00Z`, total_amount: amount, currency: 'PKR' };
}

describe('ANOMALY_CONFIRMATION_CYCLES', () => {
  it('is fixed at 2 (today + one prior evaluation) as a named, tunable constant', () => {
    expect(ANOMALY_CONFIRMATION_CYCLES).toBe(2);
  });
});

describe('computeRevenueAnomaliesFromSeries (unchanged z-score math)', () => {
  it('flags a day >= 2 standard deviations from the trailing mean, with correct direction/expectedRange', () => {
    // 8 normal days @100, two spike days @1000 (mirrors the "sustained
    // shift" gated scenario below) - asserts the raw, un-gated math is
    // untouched by the persistence-gate work.
    const series = [
      ...Array.from({ length: 8 }, (_, i) => ({ date: `2026-08-0${i + 1}`, revenue: 100 })),
      { date: '2026-08-09', revenue: 1000 },
      { date: '2026-08-10', revenue: 1000 },
    ];
    const result = computeRevenueAnomaliesFromSeries(series);
    expect(result.map((a) => a.date).sort()).toEqual(['2026-08-09', '2026-08-10']);
    const d9 = result.find((a) => a.date === '2026-08-09')!;
    expect(d9.zScore).toBe(2);
    expect(d9.direction).toBe('spike');
    expect(d9.expectedRange).toEqual([0, 1000]);
  });
});

describe('detectOwnRevenueAnomalies (persistence-gated)', () => {
  it('holds back a spike on the single most recent day until a second confirming cycle', async () => {
    // 9 normal days @100, one spike only on the very last (most recent) day.
    orderRows = [
      ...Array.from({ length: 9 }, (_, i) => revenueRow(`2026-08-0${i + 1}`, 100)),
      revenueRow('2026-08-10', 1000),
    ];
    const result = await detectOwnRevenueAnomalies('seller1', 'PKR');
    expect(result.map((a) => a.date)).not.toContain('2026-08-10');
    // The ungated math would have flagged it - proves this is the gate
    // suppressing it, not the underlying detection failing to notice.
    const ungated = computeRevenueAnomaliesFromSeries(
      orderRows.map((r) => ({ date: r.order_date.slice(0, 10), revenue: r.total_amount })),
    );
    expect(ungated.map((a) => a.date)).toContain('2026-08-10');
  });

  it('surfaces a sustained 2-day spike one day early, while the freshest day of it still waits one cycle', async () => {
    orderRows = [
      ...Array.from({ length: 8 }, (_, i) => revenueRow(`2026-08-0${i + 1}`, 100)),
      revenueRow('2026-08-09', 1000),
      revenueRow('2026-08-10', 1000),
    ];
    const result = await detectOwnRevenueAnomalies('seller1', 'PKR');
    const dates = result.map((a) => a.date);
    expect(dates).toContain('2026-08-09');
    expect(dates).not.toContain('2026-08-10');
  });

  it('fails closed (surfaces nothing) when there is not enough history for a prior confirmation cycle', async () => {
    // Exactly MIN_DAYS_FOR_BASELINE (7) days - dropping one day for the
    // prior-cycle window falls below the baseline minimum, so no anomaly
    // (even a real one) can ever be confirmed from this little history.
    orderRows = [
      ...Array.from({ length: 6 }, (_, i) => revenueRow(`2026-08-0${i + 1}`, 100)),
      revenueRow('2026-08-07', 1000),
    ];
    const result = await detectOwnRevenueAnomalies('seller1', 'PKR');
    expect(result).toEqual([]);
  });
});

describe('computePctChanges / iqrOutlierIds (unchanged IQR math, extracted as pure helpers)', () => {
  it('skips a product with no baseline price, a near-zero baseline, or a null current price', () => {
    const changes = computePctChanges(
      [
        { id: 'no-baseline', price: 100 },
        { id: 'near-zero-baseline', price: 100 },
        { id: 'null-price', price: null },
        { id: 'valid', price: 110 },
      ] as any,
      new Map([
        ['near-zero-baseline', 0.001],
        ['null-price', 100],
        ['valid', 100],
      ]),
    );
    expect(changes.map((c) => c.productId)).toEqual(['valid']);
  });

  it('flags the IQR outlier among a cluster of normal week-over-week changes', () => {
    const changes = [
      { productId: 'p1', pctChange: 1 },
      { productId: 'p2', pctChange: -1 },
      { productId: 'p3', pctChange: 2 },
      { productId: 'p4', pctChange: -2 },
      { productId: 'p5', pctChange: 0 },
      { productId: 'p6', pctChange: 1.5 },
      { productId: 'outlier', pctChange: 80 },
    ];
    const ids = iqrOutlierIds(changes);
    expect(ids.has('outlier')).toBe(true);
    expect(ids.has('p1')).toBe(false);
  });

  it('returns an empty set below the minimum sample size, same as the original early-exit', () => {
    const ids = iqrOutlierIds([
      { productId: 'a', pctChange: 1 },
      { productId: 'b', pctChange: 90 },
    ]);
    expect(ids.size).toBe(0);
  });
});

describe('detectCompetitorPriceAnomalies (persistence-gated)', () => {
  // 6-product cluster with small, unremarkable week-over-week moves, plus
  // one candidate product. Keeping only one candidate per scenario avoids
  // IQR "masking" - two simultaneous extreme values in the same sample can
  // absorb each other into the fences (Q3 shifts to include both), so
  // neither trips the outlier check. Real category data has far more than
  // 7 products, so this is a test-fixture-size artifact, not a product bug.
  const cluster = [
    { id: 'p1', title: 'Item 1', category_slug: 'gpus', price: 101, currency: 'PKR', market_platforms: { name: 'Daraz' } },
    { id: 'p2', title: 'Item 2', category_slug: 'gpus', price: 99, currency: 'PKR', market_platforms: { name: 'Daraz' } },
    { id: 'p3', title: 'Item 3', category_slug: 'gpus', price: 102, currency: 'PKR', market_platforms: { name: 'Daraz' } },
    { id: 'p4', title: 'Item 4', category_slug: 'gpus', price: 98, currency: 'PKR', market_platforms: { name: 'Daraz' } },
    { id: 'p5', title: 'Item 5', category_slug: 'gpus', price: 100, currency: 'PKR', market_platforms: { name: 'Daraz' } },
    { id: 'p6', title: 'Item 6', category_slug: 'gpus', price: 101, currency: 'PKR', market_platforms: { name: 'Daraz' } },
  ];
  function clusterBaselineRows() {
    return cluster.map((p) => ({ product_id: p.id, baseline_price: 100 }));
  }

  it('surfaces a product that is a price outlier against both the current and the prior baseline', async () => {
    productRows = [
      ...cluster,
      { id: 'confirmed-outlier', title: 'Confirmed', category_slug: 'gpus', price: 180, currency: 'PKR', market_platforms: { name: 'Daraz' } },
    ];
    baselineRowsByCycle = {
      0: [...clusterBaselineRows(), { product_id: 'confirmed-outlier', baseline_price: 100 }],
      1: [...clusterBaselineRows(), { product_id: 'confirmed-outlier', baseline_price: 100 }],
    };
    const result = await detectCompetitorPriceAnomalies('gpus', 'PKR');
    expect(result.map((a) => a.productId)).toContain('confirmed-outlier');
  });

  it('suppresses a product that was only an outlier against the current baseline, not the prior one', async () => {
    productRows = [
      ...cluster,
      { id: 'one-off-outlier', title: 'OneOff', category_slug: 'gpus', price: 180, currency: 'PKR', market_platforms: { name: 'Daraz' } },
    ];
    baselineRowsByCycle = {
      // Current (7-day) baseline makes it a lone 80% outlier; the prior
      // (8-day) baseline puts it at ~2.9%, back inside the cluster - a
      // stand-in for "the baseline row itself was a stale/glitched read".
      0: [...clusterBaselineRows(), { product_id: 'one-off-outlier', baseline_price: 100 }],
      1: [...clusterBaselineRows(), { product_id: 'one-off-outlier', baseline_price: 175 }],
    };
    const result = await detectCompetitorPriceAnomalies('gpus', 'PKR');
    expect(result.map((a) => a.productId)).not.toContain('one-off-outlier');
  });

  it('fetches the baseline RPC exactly twice (current cycle + one prior cycle)', async () => {
    productRows = cluster;
    baselineRowsByCycle = { 0: [], 1: [] };
    await detectCompetitorPriceAnomalies('gpus', 'PKR');
    expect(rpcCallCount).toBe(2);
  });
});
