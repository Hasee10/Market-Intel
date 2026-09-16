import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Two decisions this route owns, both of which are wrong by default:
//
//   1. The forecast is premium and the price stats under it are not, so the
//      block is null rather than the endpoint being a 403 - and the
//      forecast must not be COMPUTED for a plan that cannot see it.
//   2. getPortfolioPricePositions covers every category. Narrowing to the
//      one on screen is what stops the "N of M" headline counting products
//      judged against a different median.

let seller: any = { id: 'seller1', planTier: 'free', reportingCurrency: 'PKR' };
let positions: any[] = [];
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
const forecastMock = vi.fn(async (..._args: any[]) => ({ slope: 1, points: [] }));
const positionsMock = vi.fn(async (..._args: any[]) => positions);
const hasFeatureMock = vi.fn((_tier: string, _feature: string) => true);

vi.mock('@/lib/market-intel/seller/seller', () => ({
  getSellerFromRequest: async () => seller,
  resolveSelectedDomain: async () => ({
    categoryId: 'cat-beauty',
    categorySlug: 'beauty-and-personal-care',
    categoryName: 'Beauty & Personal Care',
  }),
}));

vi.mock('@/lib/market-intel/core/entitlements', () => ({
  hasFeature: (...args: any[]) => hasFeatureMock(args[0], args[1]),
}));

vi.mock('@/lib/market-intel/market/category-pricing', () => ({
  getCategoryPricing: (...args: any[]) => pricingMock(...args),
}));

vi.mock('@/lib/market-intel/market/forecast', () => ({
  getCategoryPriceForecast: (...args: any[]) => forecastMock(...args),
}));

vi.mock('@/lib/market-intel/seller/portfolio-pricing', () => ({
  getPortfolioPricePositions: (...args: any[]) => positionsMock(...args),
}));

import { GET } from './route';

function position(overrides: Record<string, unknown> = {}) {
  return {
    sellerProductId: 'p1',
    title: 'Product',
    categorySlug: 'beauty-and-personal-care',
    categoryName: 'Beauty & Personal Care',
    price: 1000,
    categoryMedian: 1000,
    perUnit: false,
    pctVsMedian: 0,
    band: 'at-market',
    ...overrides,
  };
}

function call(query = ''): Promise<Response> {
  return GET(new NextRequest(`http://localhost/api/mobile/market${query}`)) as any;
}

beforeEach(() => {
  seller = { id: 'seller1', planTier: 'free', reportingCurrency: 'PKR' };
  positions = [position()];
  pricingMock.mockClear();
  forecastMock.mockClear();
  positionsMock.mockClear();
  hasFeatureMock.mockReset();
  hasFeatureMock.mockReturnValue(true);
});

describe('GET /api/mobile/market', () => {
  it('returns the category price stats for the resolved category', async () => {
    const body = await (await call()).json();

    expect(pricingMock).toHaveBeenCalledWith('beauty-and-personal-care', 'PKR');
    expect(body.data.categoryName).toBe('Beauty & Personal Care');
    expect(body.data.pricing.median).toBe(1000);
  });

  it('includes the forecast when the plan covers forecasting', async () => {
    const body = await (await call()).json();

    expect(hasFeatureMock).toHaveBeenCalledWith('free', 'forecasting');
    expect(forecastMock).toHaveBeenCalled();
    expect(body.data.forecast).not.toBeNull();
  });

  // Not fetched-and-discarded: the forecast runs a regression over a month
  // of scraped history, and paying for it to throw the result away would be
  // the expensive way to render a null.
  it('never computes the forecast when the plan does not cover it', async () => {
    hasFeatureMock.mockReturnValue(false);
    const response = await call();
    const body = await response.json();

    expect(forecastMock).not.toHaveBeenCalled();
    expect(body.data.forecast).toBeNull();
    // The free-tier price stats underneath it still render - a 403 on the
    // whole endpoint would withhold data the seller is entitled to.
    expect(response.status).toBe(200);
    expect(body.data.pricing.median).toBe(1000);
  });

  it('narrows the price-position bands to the category on screen', async () => {
    positions = [
      position({ sellerProductId: 'p1', band: 'far-above', pctVsMedian: 0.4 }),
      position({ sellerProductId: 'p2', band: 'far-below', pctVsMedian: -0.4 }),
      // Another category entirely - must not be counted under this heading.
      position({ sellerProductId: 'p3', categorySlug: 'home-and-kitchen', band: 'far-above' }),
    ];
    const body = await (await call()).json();

    expect(body.data.pricePosition.totalProducts).toBe(2);
    expect(body.data.pricePosition.farFromMedianCount).toBe(2);
  });

  it('counts only the two outer bands as far from median', async () => {
    positions = [
      position({ sellerProductId: 'p1', band: 'above', pctVsMedian: 0.1 }),
      position({ sellerProductId: 'p2', band: 'at-market' }),
      position({ sellerProductId: 'p3', band: 'far-above', pctVsMedian: 0.4 }),
    ];
    const body = await (await call()).json();

    expect(body.data.pricePosition.totalProducts).toBe(3);
    expect(body.data.pricePosition.farFromMedianCount).toBe(1);
  });

  // The category median is scraped as-is and is NOT pack-normalised, so a
  // pack-adjusted row makes the whole comparison approximate. The client is
  // told, rather than the caveat being dropped at the boundary.
  it('flags when any row in the category was pack-size adjusted', async () => {
    positions = [position({ perUnit: false }), position({ sellerProductId: 'p2', perUnit: true })];
    const body = await (await call()).json();

    expect(body.data.pricePosition.anyPackSizeAdjusted).toBe(true);
  });

  it('labels every band, including the empty ones', async () => {
    const body = await (await call()).json();
    const bands = body.data.pricePosition.bands;

    expect(bands).toHaveLength(5);
    expect(bands[0]).toMatchObject({ band: 'far-above', label: '25%+ above' });
  });

  it('401s without a seller', async () => {
    seller = null;
    const response = await call();

    expect(response.status).toBe(401);
    expect(pricingMock).not.toHaveBeenCalled();
  });
});
