import { describe, it, expect, vi, beforeEach } from 'vitest';

// The window split, the two rates, and the "no baseline" case are the
// decisions this function owns. Currency conversion is stubbed to identity
// so the arithmetic is the only thing under test.

let rows: any[] = [];
let queryError: { message: string } | null = null;

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: async () => ({ data: queryError ? null : rows, error: queryError }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/market-intel/fx', () => ({
  getLatestFxRates: async () => ({}),
  convertCurrency: (amount: number) => amount,
}));

import { getReturnStats } from './returns';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

function order(status: string | null, amount: number, ageDays: number) {
  return { total_amount: amount, currency: 'PKR', order_date: daysAgo(ageDays), status };
}

beforeEach(() => {
  rows = [];
  queryError = null;
});

describe('getReturnStats', () => {
  it('computes return and cancel rates over the current window only', async () => {
    rows = [
      order('completed', 100, 1),
      order('refunded', 250, 2),
      order('cancelled', 80, 3),
      order('completed', 120, 5),
    ];

    const s = await getReturnStats('seller1', 'PKR', 30);

    expect(s.orders).toBe(4);
    expect(s.refunded).toBe(1);
    expect(s.cancelled).toBe(1);
    expect(s.returnRate).toBe(25);
    expect(s.cancelRate).toBe(25);
    expect(s.refundValue).toBe(250);
  });

  it('keeps refunds and cancellations separate - a cancellation is not a return', async () => {
    rows = [order('cancelled', 50, 1), order('cancelled', 50, 2), order('completed', 50, 3)];

    const s = await getReturnStats('seller1', 'PKR', 30);

    expect(s.returnRate).toBe(0);
    expect(s.refundValue).toBe(0);
    expect(s.cancelRate).toBe(66.7);
  });

  it('splits prior-window orders out and reports the change', async () => {
    rows = [
      // current: 1 of 2 refunded = 50%
      order('refunded', 100, 5),
      order('completed', 100, 6),
      // prior: 1 of 4 refunded = 25%
      order('refunded', 100, 35),
      order('completed', 100, 36),
      order('completed', 100, 37),
      order('completed', 100, 38),
    ];

    const s = await getReturnStats('seller1', 'PKR', 30);

    expect(s.returnRate).toBe(50);
    expect(s.prior.returnRate).toBe(25);
    expect(s.change.returnRate).toBe(100);
  });

  it('reports no baseline (null change) when the prior window had no refunds', async () => {
    rows = [order('refunded', 100, 5), order('completed', 100, 36)];

    const s = await getReturnStats('seller1', 'PKR', 30);

    expect(s.prior.returnRate).toBe(0);
    expect(s.change.returnRate).toBeNull();
  });

  it('returns zeros, not NaN, for a seller with no orders', async () => {
    rows = [];

    const s = await getReturnStats('seller1', 'PKR', 30);

    expect(s.orders).toBe(0);
    expect(s.returnRate).toBe(0);
    expect(s.refundValue).toBe(0);
    expect(s.change.returnRate).toBe(0);
  });

  it('throws the query error rather than swallowing it', async () => {
    queryError = { message: 'connection refused' };

    await expect(getReturnStats('seller1', 'PKR', 30)).rejects.toThrow('connection refused');
  });
});
