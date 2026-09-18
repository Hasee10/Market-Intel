import { describe, it, expect, vi, beforeEach } from 'vitest';

// What "repeat" means is the whole decision here, so each definition gets
// its own case: returning vs new is judged on first_order_at against the
// window start, guests are neither, and the revenue share follows the
// customer split.

let orderRows: any[] = [];
let customerRows: any[] = [];
let rpcRows: any[] = [];
let queryError: { message: string } | null = null;

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => {
          if (table === 'seller_orders') {
            return { gte: async () => ({ data: queryError ? null : orderRows, error: queryError }) };
          }
          return Promise.resolve({ data: customerRows, error: null });
        },
      }),
    }),
    rpc: async () => ({ data: rpcRows, error: null }),
  }),
}));

vi.mock('@/lib/market-intel/fx', () => ({
  getLatestFxRates: async () => ({}),
  convertCurrency: (amount: number) => amount,
}));

import { getRepeatStats, getCohortRetention } from './repeat';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

function order(customerId: string | null, amount: number, ageDays: number) {
  return { customer_id: customerId, total_amount: amount, currency: 'PKR', order_date: daysAgo(ageDays) };
}

beforeEach(() => {
  orderRows = [];
  customerRows = [];
  rpcRows = [];
  queryError = null;
});

describe('getRepeatStats', () => {
  it('counts a customer as repeat only if their first order predates the window', async () => {
    customerRows = [
      { id: 'old', first_order_at: daysAgo(90) },   // returning
      { id: 'new', first_order_at: daysAgo(10) },   // acquired inside the window
    ];
    orderRows = [order('old', 100, 5), order('old', 100, 6), order('new', 300, 4)];

    const s = await getRepeatStats('seller1', 'PKR', 30);

    expect(s.customersOrdered).toBe(2);
    expect(s.repeatCustomers).toBe(1);
    expect(s.newCustomers).toBe(1);
    expect(s.repeatShare).toBe(50);
    // revenue: 200 from the returning customer, 300 from the new one
    expect(s.revenue).toBe(500);
    expect(s.repeatRevenue).toBe(200);
    expect(s.repeatRevenueShare).toBe(40);
  });

  it('counts guest orders in revenue but never as repeat or new customers', async () => {
    customerRows = [{ id: 'old', first_order_at: daysAgo(90) }];
    orderRows = [order('old', 100, 5), order(null, 400, 6)];

    const s = await getRepeatStats('seller1', 'PKR', 30);

    expect(s.customersOrdered).toBe(1);
    expect(s.guestOrders).toBe(1);
    expect(s.revenue).toBe(500);
    expect(s.repeatRevenueShare).toBe(20);
  });

  it('judges the prior window against its own start, not the current one', async () => {
    // Customer acquired 40 days ago. In the PRIOR window (60..30 days ago)
    // they were new; in the current window they are returning.
    customerRows = [{ id: 'c', first_order_at: daysAgo(40) }];
    orderRows = [order('c', 100, 40), order('c', 100, 5)];

    const s = await getRepeatStats('seller1', 'PKR', 30);

    expect(s.repeatShare).toBe(100);
    expect(s.prior.repeatShare).toBe(0);
  });

  it('returns zeros, not NaN, with no orders', async () => {
    const s = await getRepeatStats('seller1', 'PKR', 30);

    expect(s.customersOrdered).toBe(0);
    expect(s.repeatShare).toBe(0);
    expect(s.repeatRevenueShare).toBe(0);
  });

  it('throws the query error rather than swallowing it', async () => {
    queryError = { message: 'connection refused' };

    await expect(getRepeatStats('seller1', 'PKR', 30)).rejects.toThrow('connection refused');
  });
});

describe('getCohortRetention', () => {
  it('maps the RPC rows to camelCase numbers', async () => {
    rpcRows = [
      { cohort_month: '2026-07-01', month_offset: 0, customers: '12', retained: '12', retention_rate: '100.0' },
      { cohort_month: '2026-07-01', month_offset: 1, customers: '12', retained: '5', retention_rate: '41.7' },
    ];

    const rows = await getCohortRetention('seller1', 6);

    expect(rows).toEqual([
      { cohortMonth: '2026-07-01', monthOffset: 0, customers: 12, retained: 12, retentionRate: 100 },
      { cohortMonth: '2026-07-01', monthOffset: 1, customers: 12, retained: 5, retentionRate: 41.7 },
    ]);
  });
});
