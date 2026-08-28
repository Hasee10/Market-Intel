import { describe, it, expect, vi, beforeEach } from 'vitest';

// Smoke test for findCompetitorsForProduct's price-bracket matching model
// (2026-08-28): same category + seller price +/-15% is the hard filter,
// title similarity is a ranking signal only, never an inclusion filter.

const marketRows: any[] = [];
const upsertedMatchRows: any[] = [];
let sellerProductRow: any = { id: 'sp1', title: 'RTX 4070 GPU', sell_price: 100000, currency: 'PKR' };

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'seller_products') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async (): Promise<{ data: any; error: null }> => ({ data: sellerProductRow, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'market_products') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                in: () => ({
                  limit: async (): Promise<{ data: any[]; error: null }> => ({ data: marketRows, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'seller_product_competitor_matches') {
        return {
          upsert: async (rows: any[]): Promise<{ error: null }> => {
            upsertedMatchRows.push(...rows);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock('@/lib/market-intel/market-definition', () => ({
  getMarketScope: async () => ({ categorySlugs: ['gpus'], activePlatformIds: ['p1', 'p2'] }),
}));

vi.mock('@/lib/market-intel/fx', () => ({
  getLatestFxRates: async () => ({ PKR: 1 }),
  convertCurrency: (amount: number) => amount,
}));

import { findCompetitorsForProduct } from './product-matching';

type MarketRow = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  url: string;
  rating: number | null;
  rating_count: number | null;
  sold_count: number | null;
  category_slug: string;
  market_platforms: { name: string };
};

function marketRow(overrides: Partial<MarketRow>): MarketRow {
  return {
    id: 'mp1',
    title: 'GPU',
    price: 100000,
    currency: 'PKR',
    url: 'https://example.com/x',
    rating: null,
    rating_count: null,
    sold_count: null,
    category_slug: 'gpus',
    market_platforms: { name: 'Daraz' },
    ...overrides,
  };
}

beforeEach(() => {
  marketRows.length = 0;
  upsertedMatchRows.length = 0;
  sellerProductRow = { id: 'sp1', title: 'RTX 4070 GPU', sell_price: 100000, currency: 'PKR' };
});

describe('findCompetitorsForProduct', () => {
  it('excludes candidates outside the +/-15% price bracket even with a matching title', async () => {
    marketRows.push(
      marketRow({ title: 'RTX 4070 GPU', price: 100000, url: 'in-bracket' }),
      marketRow({ title: 'RTX 4070 GPU', price: 300000, url: 'way-too-expensive' }),
    );

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result).toHaveLength(1);
    expect(result[0].matchedUrl).toBe('in-bracket');
  });

  it('includes a differently-titled product that falls in the same price bracket (the GPU case)', async () => {
    marketRows.push(marketRow({ title: 'Completely Different Brand Graphics Card', price: 108000, url: 'diff-name-same-price' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result).toHaveLength(1);
    expect(result[0].matchedUrl).toBe('diff-name-same-price');
  });

  it('ranks higher title-similarity matches first within the bracket', async () => {
    marketRows.push(
      marketRow({ title: 'Totally Unrelated Item Name', price: 105000, url: 'low-similarity' }),
      marketRow({ title: 'RTX 4070 GPU', price: 95000, url: 'high-similarity' }),
    );

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result[0].matchedUrl).toBe('high-similarity');
  });

  it('excludes a candidate with no price when a bracket exists (cannot judge it)', async () => {
    marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: null, url: 'no-price' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result).toHaveLength(0);
  });

  it('falls back to no price filter when the seller product has no sell_price yet', async () => {
    sellerProductRow = { id: 'sp1', title: 'RTX 4070 GPU', sell_price: null, currency: 'PKR' };
    marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 999999, url: 'any-price-allowed' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result).toHaveLength(1);
    expect(result[0].matchedUrl).toBe('any-price-allowed');
  });

  it('passes rating/ratingCount/soldCount through as null, never coerced to 0', async () => {
    marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 100000, rating: null, sold_count: null, url: 'nulls' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result[0].rating).toBeNull();
    expect(result[0].soldCount).toBeNull();
  });

  it('persists the top matches into seller_product_competitor_matches, keyed by seller+market product', async () => {
    marketRows.push(marketRow({ id: 'mp-target', title: 'RTX 4070 GPU', price: 100000, url: 'in-bracket' }));

    await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(upsertedMatchRows).toHaveLength(1);
    expect(upsertedMatchRows[0]).toMatchObject({
      seller_id: 'seller1',
      seller_product_id: 'sp1',
      market_product_id: 'mp-target',
    });
    expect(upsertedMatchRows[0].confidence).toBeGreaterThan(0);
    expect(upsertedMatchRows[0].last_confirmed_at).toEqual(expect.any(String));
    expect(upsertedMatchRows[0].first_matched_at).toBeUndefined();
  });

  it('does not persist anything when no candidates are in bracket', async () => {
    marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 300000, url: 'way-too-expensive' }));

    await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(upsertedMatchRows).toHaveLength(0);
  });

  it('caps results at the given limit', async () => {
    for (let i = 0; i < 10; i++) {
      marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 100000, url: `listing-${i}` }));
    }

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus', 'PKR', 5);

    expect(result).toHaveLength(5);
  });
});
