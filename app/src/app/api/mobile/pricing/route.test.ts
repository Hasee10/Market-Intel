import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Two things are pinned here, both of which a client developer could
// otherwise "fix" into a bug:
//
//   1. The result set is the whole catalogue, not the selected category.
//      categorySlug scopes the title-matching pass only. A row from another
//      category surviving the response is the CORRECT behaviour.
//   2. The cursor is an opaque offset that round-trips, and an unreadable
//      one is a 400 rather than a silent restart at page one.

let seller: any = { id: 'seller1', planTier: 'premium', reportingCurrency: 'PKR' };
let recommendations: any[] = [];
const recommendationsMock = vi.fn(async (..._args: any[]) => recommendations);
const hasFeatureMock = vi.fn((_tier: string, _feature: string) => true);

vi.mock('@/lib/market-intel/core/entitlements', () => ({
  hasFeature: (...args: any[]) => hasFeatureMock(args[0], args[1]),
}));

vi.mock('@/lib/market-intel/seller/seller', () => ({
  getSellerFromRequest: async () => seller,
  resolveSelectedDomain: async () => ({
    categoryId: 'cat-beauty',
    categorySlug: 'beauty-and-personal-care',
    categoryName: 'Beauty & Personal Care',
  }),
}));

vi.mock('@/lib/market-intel/seller/pricing-recommendation', () => ({
  getPricingRecommendations: (...args: any[]) => recommendationsMock(...args),
}));

vi.mock('@/lib/market-intel/seller/categories', () => ({
  getSellerCategories: async () => [
    { id: 'cat-beauty', slug: 'beauty-and-personal-care', name: 'Beauty & Personal Care', productCount: 2 },
    { id: 'cat-home', slug: 'home-and-kitchen', name: 'Home & Kitchen', productCount: 1 },
  ],
}));

import { GET } from './route';

function recommendation(i: number, categorySlug = 'beauty-and-personal-care') {
  return {
    productId: `p${i}`,
    productTitle: `Product ${i}`,
    categorySlug,
    duplicateEntries: 1,
    costPrice: 500,
    currentPrice: 1000,
    recommendedPrice: 1200,
    competitorLow: 1100,
    competitorHigh: 1300,
    matchConfidence: 0.7,
    marginConstrained: false,
    direction: 'increase' as const,
    rationale: 'Room to raise price.',
  };
}

function call(query = ''): Promise<Response> {
  return GET(new NextRequest(`http://localhost/api/mobile/pricing${query}`)) as any;
}

beforeEach(() => {
  seller = { id: 'seller1', planTier: 'premium', reportingCurrency: 'PKR' };
  recommendations = [recommendation(1)];
  recommendationsMock.mockClear();
  hasFeatureMock.mockReset();
  hasFeatureMock.mockReturnValue(true);
});

describe('GET /api/mobile/pricing', () => {
  it('passes the selected category through as the match scope, not a filter', async () => {
    recommendations = [recommendation(1), recommendation(2, 'home-and-kitchen')];
    const body = await (await call()).json();

    expect(recommendationsMock).toHaveBeenCalledWith('seller1', 'beauty-and-personal-care', 'PKR');
    expect(body.data.matchScopeCategorySlug).toBe('beauty-and-personal-care');
    // The Home & Kitchen row must survive. Dropping it here, or client-side,
    // hides valid advice - see pricing-recommendation.ts.
    expect(body.data.recommendations.map((r: any) => r.categorySlug)).toEqual([
      'beauty-and-personal-care',
      'home-and-kitchen',
    ]);
  });

  it('names each row with its own category, never the one on screen', async () => {
    recommendations = [recommendation(1, 'home-and-kitchen')];
    const body = await (await call()).json();

    expect(body.data.recommendations[0].categoryName).toBe('Home & Kitchen');
  });

  it('never exposes cost price', async () => {
    const body = await (await call()).json();

    expect(body.data.recommendations[0]).not.toHaveProperty('costPrice');
  });

  it('pages with an opaque cursor that round-trips', async () => {
    recommendations = Array.from({ length: 25 }, (_, i) => recommendation(i));

    const first = await (await call()).json();
    expect(first.data.recommendations).toHaveLength(20);
    expect(first.data.totalCount).toBe(25);
    expect(first.data.nextCursor).toBeTypeOf('string');

    const second = await (
      await call(`?cursor=${encodeURIComponent(first.data.nextCursor)}`)
    ).json();
    expect(second.data.recommendations).toHaveLength(5);
    expect(second.data.recommendations[0].productId).toBe('p20');
    // Null, so the client's "keep calling until nextCursor is null" loop
    // terminates rather than re-serving the tail forever.
    expect(second.data.nextCursor).toBeNull();
  });

  it('returns a null cursor when everything fits on one page', async () => {
    const body = await (await call()).json();
    expect(body.data.nextCursor).toBeNull();
  });

  it('400s on an unreadable cursor rather than restarting at page one', async () => {
    const response = await call('?cursor=not-a-real-cursor');

    expect(response.status).toBe(400);
    expect(recommendationsMock).not.toHaveBeenCalled();
  });

  // hasFeature is stubbed rather than driven through planTier because
  // DEMO_ALL_FEATURES_UNLOCKED is currently true, so no 403 is reachable
  // from a tier alone. Stubbing pins that the endpoint asks the entitlement
  // layer at all, and refuses when told no - which is what must still hold
  // the day that flag is turned off.
  it('403s when entitlements refuse pricing_recommendations', async () => {
    hasFeatureMock.mockReturnValue(false);
    const response = await call();

    expect(hasFeatureMock).toHaveBeenCalledWith('premium', 'pricing_recommendations');
    expect(response.status).toBe(403);
    expect(recommendationsMock).not.toHaveBeenCalled();
  });

  it('401s without a seller', async () => {
    seller = null;
    const response = await call();

    expect(response.status).toBe(401);
    expect(recommendationsMock).not.toHaveBeenCalled();
  });
});
