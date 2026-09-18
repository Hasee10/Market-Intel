import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// The only decision this route makes is the emptyReason. The list itself
// is listSellerDomains verbatim minus categoryId, so the seller and the
// domains are stubbed and the assertions stay on that one decision.

let seller: any = { id: 'seller1', planTier: 'free', reportingCurrency: 'PKR' };
let domains: any[] = [];

vi.mock('@/lib/market-intel/seller/seller', () => ({
  getSellerFromRequest: async () => seller,
  listSellerDomains: async () => domains,
}));

import { GET } from './route';

function call(): Promise<Response> {
  return GET(new NextRequest('http://localhost/api/mobile/categories')) as any;
}

beforeEach(() => {
  seller = { id: 'seller1', planTier: 'free', reportingCurrency: 'PKR' };
  domains = [];
});

describe('GET /api/mobile/categories', () => {
  it('names the cause when the seller tracks no market, instead of a bare empty list', async () => {
    // A test account with products but no completed onboarding hits
    // exactly this, and it was reported as a broken endpoint. The empty
    // list is correct; the code says why.
    domains = [];

    const res = await call();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.categories).toEqual([]);
    expect(body.data.emptyReason).toBe('no_tracked_markets');
  });

  it('returns null emptyReason and drops categoryId when markets exist', async () => {
    domains = [
      { id: 'd1', categoryId: 'c1', categorySlug: 'beauty-and-personal-care', categoryName: 'Beauty & Personal Care', isPrimary: true },
      { id: 'd2', categoryId: 'c2', categorySlug: 'home-and-kitchen', categoryName: 'Home & Kitchen', isPrimary: false },
    ];

    const res = await call();
    const body = await res.json();

    expect(body.data.emptyReason).toBeNull();
    expect(body.data.categories).toEqual([
      { categorySlug: 'beauty-and-personal-care', categoryName: 'Beauty & Personal Care', isPrimary: true },
      { categorySlug: 'home-and-kitchen', categoryName: 'Home & Kitchen', isPrimary: false },
    ]);
  });

  it('returns 401 without a seller', async () => {
    seller = null;
    const res = await call();
    expect(res.status).toBe(401);
  });
});
