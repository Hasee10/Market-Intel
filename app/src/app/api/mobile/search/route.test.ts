import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// This runs on every keystroke, so the thing worth pinning is what it does
// NOT do: no query below the floor reaches the database, and a short query
// is a normal 200 rather than an error the client has to render a failure
// card for.

let seller: any = { id: 'seller1', planTier: 'paid', reportingCurrency: 'PKR' };
let results: any[] = [];
const searchMock = vi.fn(async (..._args: any[]) => results);
const hasFeatureMock = vi.fn((_tier: string, _feature: string) => true);

vi.mock('@/lib/market-intel/seller/seller', () => ({
  getSellerFromRequest: async () => seller,
  resolveSelectedDomain: async () => null,
}));

vi.mock('@/lib/market-intel/core/entitlements', () => ({
  hasFeature: (...args: any[]) => hasFeatureMock(args[0], args[1]),
}));

vi.mock('@/lib/market-intel/seller/watchlists', () => ({
  searchMarketProducts: (...args: any[]) => searchMock(...args),
}));

import { GET } from './route';

function call(query = ''): Promise<Response> {
  return GET(new NextRequest(`http://localhost/api/mobile/search${query}`)) as any;
}

beforeEach(() => {
  seller = { id: 'seller1', planTier: 'paid', reportingCurrency: 'PKR' };
  results = [
    {
      id: 'm1',
      title: 'Dior Eau Sauvage 100ml',
      platformName: 'Al-Fatah',
      price: 21900,
      currency: 'PKR',
      inStock: true,
      imageUrl: null,
      url: 'https://example.test/1',
    },
  ];
  searchMock.mockClear();
  hasFeatureMock.mockReset();
  hasFeatureMock.mockReturnValue(true);
});

describe('GET /api/mobile/search', () => {
  it.each(['', '?q=', '?q=d', '?q=%20%20'])(
    'returns an empty 200 without querying for %s',
    async (query) => {
      const response = await call(query);

      expect(response.status).toBe(200);
      expect(searchMock).not.toHaveBeenCalled();
      const body = await response.json();
      expect(body.data.results).toEqual([]);
      expect(body.message).toContain('2 characters');
    },
  );

  it('searches everything scraped when no category is given', async () => {
    await call('?q=dior');
    expect(searchMock).toHaveBeenCalledWith('dior', undefined);
  });

  it('narrows to one market when a category is given', async () => {
    await call('?q=dior&categorySlug=beauty-and-personal-care');
    expect(searchMock).toHaveBeenCalledWith('dior', 'beauty-and-personal-care');
  });

  it('trims the query before applying the floor and before searching', async () => {
    await call('?q=%20dior%20');
    expect(searchMock).toHaveBeenCalledWith('dior', undefined);
  });

  // Per row, not per response: these are scraped prices in their own
  // currency, never converted to the seller's reporting currency, and a
  // top-level currency field would be a claim we cannot make about a market
  // carrying more than one.
  it('carries currency on each row', async () => {
    const body = await (await call('?q=dior')).json();

    expect(body.data.results[0]).toMatchObject({ price: 21900, currency: 'PKR' });
    expect(body.data).not.toHaveProperty('currency');
  });

  // Present rather than omitted, so a client that special-cased its absence
  // does not break the day pagination lands.
  it('always reports a null cursor', async () => {
    const body = await (await call('?q=dior')).json();
    expect(body.data.nextCursor).toBeNull();
  });

  it('403s when entitlements refuse competitor_intel', async () => {
    hasFeatureMock.mockReturnValue(false);
    const response = await call('?q=dior');

    expect(hasFeatureMock).toHaveBeenCalledWith('paid', 'competitor_intel');
    expect(response.status).toBe(403);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('401s without a seller', async () => {
    seller = null;
    const response = await call('?q=dior');

    expect(response.status).toBe(401);
    expect(searchMock).not.toHaveBeenCalled();
  });
});
