import { describe, it, expect, beforeEach, vi } from 'vitest';

// Regression cover for a defect introduced and then caught within the same
// change that moved these five functions out of their /api/ecommerce/*
// route handlers (see this file's sibling overview.ts and its header
// comment). Two things had to survive that move exactly, not just
// approximately:
//
//   1. A genuine Supabase query error must still be distinguishable from
//      "zero rows" - the original routes returned a 500 with the query
//      error's message; a first draft here swallowed every error into an
//      empty array instead, which silently turned every 500 into a 200.
//   2. `data: null, error: null` (Supabase's type allows this even without
//      an error) must still fall back to an empty collection, not throw a
//      raw TypeError from calling .map()/.length on null - the original
//      routes did `(data ?? [])` everywhere; restoring the throw-on-error
//      behaviour above briefly dropped that fallback in three of the five
//      functions along the way.
//
// Every test below is phrased as a behaviour the ORIGINAL route guaranteed,
// not as an implementation detail of how it's written now.

type Resp = { data: any; error: { message: string } | null };

const responses: Record<string, Resp> = {};

function setResponse(table: string, resp: Resp) {
  responses[table] = resp;
}

// Minimal fake query builder: every chained call (.select/.eq/.gte/...)
// returns the same thenable object, so it supports whatever chain length
// each function uses without hand-coding each shape - and resolves via
// `.then()` the same way the real Supabase client's builder does, so
// `await supabase.from(...).select(...).eq(...)` works unmodified.
function fakeTable(table: string) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    then: (resolve: (v: Resp) => void) => resolve(responses[table] ?? { data: [], error: null }),
  };
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => fakeTable(table),
  }),
}));

vi.mock('@/lib/market-intel/fx', () => ({
  getLatestFxRates: async () => ({ PKR: 1 }),
  convertCurrency: (amount: number) => amount,
}));

import {
  getCategoryInventoryValue,
  getEcommerceStats,
  getOrderStatusBreakdown,
  getRevenueTrend,
  getTopProductsByInventoryValue,
} from './overview';

beforeEach(() => {
  for (const key of Object.keys(responses)) delete responses[key];
});

describe('getEcommerceStats', () => {
  it('throws the underlying Supabase error message rather than swallowing it', async () => {
    setResponse('seller_orders', { data: null, error: { message: 'relation does not exist' } });
    setResponse('seller_customers', { data: [], error: null });
    setResponse('seller_products', { data: [], error: null });

    await expect(getEcommerceStats('seller1', 'PKR')).rejects.toThrow('relation does not exist');
  });

  it('resolves with real data when nothing errors', async () => {
    setResponse('seller_orders', { data: [], error: null });
    setResponse('seller_customers', { data: [], error: null });
    setResponse('seller_products', { data: [], error: null });

    const stats = await getEcommerceStats('seller1', 'PKR');
    expect(stats.map((s) => s.title)).toContain('Revenue (30d)');
  });
});

describe('getTopProductsByInventoryValue', () => {
  it('throws on a query error', async () => {
    setResponse('seller_products', { data: null, error: { message: 'permission denied' } });
    await expect(getTopProductsByInventoryValue('seller1', 'PKR')).rejects.toThrow('permission denied');
  });

  it('returns an empty list rather than throwing when data is null with no error', async () => {
    // A real Supabase response shape that carries no error: an empty table,
    // or (rarely) a null payload the client still typed as non-error.
    setResponse('seller_products', { data: null, error: null });
    await expect(getTopProductsByInventoryValue('seller1', 'PKR')).resolves.toEqual([]);
  });
});

describe('getOrderStatusBreakdown', () => {
  it('throws on a query error', async () => {
    setResponse('seller_orders', { data: null, error: { message: 'timeout' } });
    await expect(getOrderStatusBreakdown('seller1')).rejects.toThrow('timeout');
  });

  it('returns an empty list rather than throwing when data is null with no error', async () => {
    setResponse('seller_orders', { data: null, error: null });
    await expect(getOrderStatusBreakdown('seller1')).resolves.toEqual([]);
  });
});

describe('getCategoryInventoryValue', () => {
  it('throws on a query error', async () => {
    setResponse('seller_products', { data: null, error: { message: 'connection reset' } });
    await expect(getCategoryInventoryValue('seller1')).rejects.toThrow('connection reset');
  });

  it('returns an empty list rather than throwing when data is null with no error', async () => {
    setResponse('seller_products', { data: null, error: null });
    await expect(getCategoryInventoryValue('seller1')).resolves.toEqual([]);
  });
});

describe('getRevenueTrend', () => {
  it('throws on a query error', async () => {
    setResponse('seller_orders', { data: null, error: { message: 'query failed' } });
    await expect(getRevenueTrend('seller1', 'PKR')).rejects.toThrow('query failed');
  });

  it('still produces 30 zeroed days when data is null with no error', async () => {
    setResponse('seller_orders', { data: null, error: null });
    const trend = await getRevenueTrend('seller1', 'PKR');
    expect(trend).toHaveLength(30);
    expect(trend.every((p) => p.revenue === 0)).toBe(true);
  });
});
