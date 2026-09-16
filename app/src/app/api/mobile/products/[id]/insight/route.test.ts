import { describe, it, expect, vi, beforeEach } from 'vitest';

// The ownership check and the "we couldn't place this product" path are the
// two things worth pinning. The market arithmetic itself is
// price-position-bands.ts's, which has its own tests - this only asserts
// that this route feeds it the pack-normalised, currency-converted price
// rather than the raw sell_price.

let seller: any = { id: 'seller1', planTier: 'paid', reportingCurrency: 'PKR' };
let productRow: any;
let productError: any = null;
const productQuery = { id: null as string | null, sellerId: null as string | null };

const pricingMock = vi.fn(async (..._args: any[]) => ({
  categorySlug: 'beauty-and-personal-care',
  count: 120,
  minPrice: 100,
  p25: 500,
  median: 1000,
  p75: 1500,
  maxPrice: 5000,
  avgPrice: 1100,
  samplePlatforms: ['Daraz'],
}));
const competitorsMock = vi.fn(async (..._args: any[]) => [] as any[]);
const historyMock = vi.fn(async (..._args: any[]) => [] as any[]);
const hasFeatureMock = vi.fn((_tier: string, _feature: string) => true);

vi.mock('@/lib/market-intel/seller/seller', () => ({
  getSellerFromRequest: async () => seller,
  resolveSelectedDomain: async () => null,
}));

vi.mock('@/lib/market-intel/core/entitlements', () => ({
  hasFeature: (...args: any[]) => hasFeatureMock(args[0], args[1]),
}));

vi.mock('@/lib/market-intel/fx', () => ({
  // Identity conversion: FX is fx.ts's job and is tested there. Keeping it
  // flat here means a wrong number in this test is this route's fault.
  convertCurrency: (value: number) => value,
  getLatestFxRates: async () => ({}),
}));

vi.mock('@/lib/market-intel/market/category-pricing', () => ({
  getCategoryPricing: (...args: any[]) => pricingMock(...args),
}));

vi.mock('@/lib/market-intel/market/product-matching', () => ({
  findCompetitorsForProduct: (...args: any[]) => competitorsMock(...args),
}));

vi.mock('@/lib/market-intel/seller/price-history', () => ({
  getSellerPriceHistory: (...args: any[]) => historyMock(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => {
          productQuery.id = id;
          return {
            eq: (_col2: string, sellerId: string) => {
              productQuery.sellerId = sellerId;
              return { maybeSingle: async () => ({ data: productRow, error: productError }) };
            },
          };
        },
      }),
    }),
  }),
}));

import { GET } from './route';

function call(id = 'p1'): Promise<Response> {
  return GET(new Request(`http://localhost/api/mobile/products/${id}/insight`), {
    params: Promise.resolve({ id }),
  }) as any;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    title: 'Dior Eau Sauvage 100ml',
    sell_price: 900,
    currency: 'PKR',
    image_url: null,
    seller_categories: { slug: 'beauty-and-personal-care', name: 'Beauty & Personal Care' },
    ...overrides,
  };
}

beforeEach(() => {
  seller = { id: 'seller1', planTier: 'paid', reportingCurrency: 'PKR' };
  productRow = row();
  productError = null;
  productQuery.id = null;
  productQuery.sellerId = null;
  pricingMock.mockClear();
  competitorsMock.mockClear();
  competitorsMock.mockImplementation(async () => []);
  historyMock.mockClear();
  historyMock.mockImplementation(async () => []);
  hasFeatureMock.mockReset();
  hasFeatureMock.mockReturnValue(true);
});

describe('GET /api/mobile/products/[id]/insight', () => {
  // seller_id in the filter as well as RLS - one dropped policy must not
  // mean someone else's product title comes back.
  it('scopes the lookup by seller as well as by id', async () => {
    await call('p1');
    expect(productQuery).toEqual({ id: 'p1', sellerId: 'seller1' });
  });

  it('404s on a product that is not the seller\'s', async () => {
    productRow = null;
    const response = await call('someone-elses');

    expect(response.status).toBe(404);
    expect(pricingMock).not.toHaveBeenCalled();
  });

  it('places the product against its own category median', async () => {
    const body = await (await call()).json();

    expect(pricingMock).toHaveBeenCalledWith('beauty-and-personal-care', 'PKR');
    expect(body.data.vsMarket).toMatchObject({
      categoryMedian: 1000,
      comparedPrice: 900,
      pctVsMedian: -0.1,
      band: 'below',
      bandLabel: '5–25% below',
      perUnit: false,
      sampleSize: 120,
    });
  });

  // Without this a 6-pack is judged "far above" a single-unit median. Only
  // the seller's side is normalised, which is why perUnit is carried.
  it('divides out the pack size the title states, and says that it did', async () => {
    productRow = row({ title: 'Lip Tint Pack of 3', sell_price: 3000 });
    const body = await (await call()).json();

    expect(body.data.vsMarket.comparedPrice).toBe(1000);
    expect(body.data.vsMarket.band).toBe('at-market');
    expect(body.data.vsMarket.perUnit).toBe(true);
  });

  // An onboarding gap, not a failure. The client says "map this to a
  // category", rather than rendering a blank comparison.
  it('returns a 200 with a null comparison when the product has no category', async () => {
    productRow = row({ seller_categories: null });
    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.vsMarket).toBeNull();
    expect(body.data.closestCompetitors).toEqual([]);
    expect(pricingMock).not.toHaveBeenCalled();
    // History is the seller's own record and needs no market data, so it is
    // still fetched.
    expect(historyMock).toHaveBeenCalled();
  });

  it('returns a null comparison when the product has no price', async () => {
    productRow = row({ sell_price: null });
    const body = await (await call()).json();

    expect(body.data.product.price).toBeNull();
    expect(body.data.vsMarket).toBeNull();
  });

  it('asks for the five closest competitors and drops the desktop-only columns', async () => {
    competitorsMock.mockImplementation(async () => [
      {
        matchedTitle: 'Dior Eau Sauvage 100ml EDT',
        matchedPlatformName: 'Daraz',
        matchedPrice: 1100,
        matchedUrl: 'https://example.test/1',
        matchedImageUrl: null,
        duplicateCount: 2,
        unitCount: 1,
        sellerUnitCount: 1,
        rating: 4.5,
        ratingCount: 90,
        soldCount: 12,
        confidence: 0.81,
        matchStrength: 'strong',
        sellerPrice: 900,
        priceDeltaPct: -0.18,
        reviewCount: 3,
        topReviews: [],
      },
    ]);

    const body = await (await call()).json();

    expect(competitorsMock).toHaveBeenCalledWith(
      'seller1',
      'p1',
      'beauty-and-personal-care',
      'PKR',
      5,
    );
    const competitor = body.data.closestCompetitors[0];
    expect(competitor).toMatchObject({
      title: 'Dior Eau Sauvage 100ml EDT',
      platformName: 'Daraz',
      matchConfidence: 0.81,
      priceDeltaPct: -0.18,
    });
    expect(competitor).not.toHaveProperty('topReviews');
    expect(competitor).not.toHaveProperty('soldCount');
  });

  it('keeps only the last 30 days of the seller\'s own price history', async () => {
    const day = 24 * 60 * 60 * 1000;
    historyMock.mockImplementation(async () => [
      { sellPrice: 800, recordedAt: new Date(Date.now() - 60 * day).toISOString() },
      { sellPrice: 900, recordedAt: new Date(Date.now() - 5 * day).toISOString() },
      // Null prices are points with nothing to plot.
      { sellPrice: null, recordedAt: new Date(Date.now() - 2 * day).toISOString() },
    ]);

    const body = await (await call()).json();

    expect(body.data.priceHistory).toHaveLength(1);
    expect(body.data.priceHistory[0].price).toBe(900);
    expect(body.data.priceHistory[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('403s when entitlements refuse watchlists', async () => {
    hasFeatureMock.mockReturnValue(false);
    const response = await call();

    expect(hasFeatureMock).toHaveBeenCalledWith('paid', 'watchlists');
    expect(response.status).toBe(403);
  });

  it('401s without a seller', async () => {
    seller = null;
    const response = await call();
    expect(response.status).toBe(401);
  });
});
