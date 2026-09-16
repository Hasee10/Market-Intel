import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// The period whitelist and the change arithmetic are the only two things
// this route owns - the figures themselves come from getSellerKpiTotals,
// which has its own tests. So the seller and the totals are both stubbed
// and the assertions stay on what the handler decides.

let seller: any = { id: 'seller1', planTier: 'free', reportingCurrency: 'PKR' };
let totals: any;
const totalsMock = vi.fn(async (..._args: any[]) => totals);

vi.mock('@/lib/market-intel/seller/seller', () => ({
  getSellerFromRequest: async () => seller,
  resolveSelectedDomain: async () => null,
}));

vi.mock('@/lib/market-intel/seller/overview', () => ({
  getSellerKpiTotals: (...args: any[]) => totalsMock(...args),
}));

import { GET } from './route';

function makeTotals(overrides: Partial<Record<string, number>> = {}) {
  return {
    periodDays: 30,
    revenue: 1000,
    priorRevenue: 800,
    orders: 10,
    priorOrders: 8,
    aov: 100,
    priorAov: 100,
    newCustomers: 3,
    priorNewCustomers: 0,
    activeProducts: 5,
    totalProducts: 6,
    lowStockProducts: 1,
    ...overrides,
  };
}

function call(query = ''): Promise<Response> {
  return GET(new NextRequest(`http://localhost/api/mobile/kpis${query}`)) as any;
}

async function kpisFrom(response: Response) {
  const body = await response.json();
  return Object.fromEntries(body.data.kpis.map((k: any) => [k.key, k]));
}

beforeEach(() => {
  seller = { id: 'seller1', planTier: 'free', reportingCurrency: 'PKR' };
  totals = makeTotals();
  totalsMock.mockClear();
});

describe('GET /api/mobile/kpis', () => {
  it('defaults to 30 days and reports what it compared against', async () => {
    const body = await (await call()).json();

    expect(totalsMock).toHaveBeenCalledWith('seller1', 'PKR', 30);
    expect(body.data.period).toBe('30d');
    expect(body.data.comparedTo).toBe('prior 30 days');
  });

  it('accepts 90d', async () => {
    await call('?period=90d');
    expect(totalsMock).toHaveBeenCalledWith('seller1', 'PKR', 90);
  });

  // The important half of the whitelist: a client that asks for a window it
  // will not get, and is told it did, surfaces as wrong numbers rather than
  // as an error anyone can report.
  it('rejects an unsupported period instead of falling back', async () => {
    const response = await call('?period=7d');

    expect(response.status).toBe(400);
    expect(totalsMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.succeeded).toBe(false);
    expect(body.errors[0]).toContain('30d');
  });

  it('computes a signed percentage change against the prior period', async () => {
    const kpis = await kpisFrom(await call());

    expect(kpis.revenue.diffPct).toBe(25);
    expect(kpis.revenue.direction).toBe('up');
  });

  it('reports a decrease as negative and down', async () => {
    totals = makeTotals({ revenue: 600, priorRevenue: 800 });
    const kpis = await kpisFrom(await call());

    expect(kpis.revenue.diffPct).toBe(-25);
    expect(kpis.revenue.direction).toBe('down');
  });

  // A brand new account must render no change indicator at all, rather than
  // a confident 0% claiming flat performance it has no evidence for.
  it('returns null - not zero - when there is no prior period to compare', async () => {
    const kpis = await kpisFrom(await call());

    expect(kpis.new_customers.diffPct).toBeNull();
    expect(kpis.new_customers.direction).toBe('flat');
  });

  it('rounds money at the boundary so every client shows the same figure', async () => {
    totals = makeTotals({ aov: 123.456, priorAov: 123.456 });
    const kpis = await kpisFrom(await call());

    expect(kpis.aov.value).toBe(123.46);
    expect(kpis.aov.format).toBe('money');
    expect(kpis.orders.format).toBe('count');
  });

  it('401s without a seller', async () => {
    seller = null;
    const response = await call();

    expect(response.status).toBe(401);
    expect(totalsMock).not.toHaveBeenCalled();
  });
});
