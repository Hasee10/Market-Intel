import { describe, it, expect, vi, beforeEach } from 'vitest';

// Smoke test for findCompetitorsForProduct's matching model (revised
// 2026-08-28): title similarity (Jaccard, MIN_COMPETITOR_CONFIDENCE) is the
// hard filter deciding inclusion; price is never a filter, only a sort
// tiebreak. Results are then selected round-robin across platforms so one
// platform's denser candidate pool can't crowd out another's.

const marketRows: any[] = [];
const upsertedMatchRows: any[] = [];
let reviewRows: any[] = [];
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
      if (table === 'market_product_reviews') {
        return {
          select: () => ({
            in: () => ({
              order: async (): Promise<{ data: any[]; error: null }> => ({ data: reviewRows, error: null }),
            }),
          }),
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

// next/server's after() only works inside a real Next.js request scope -
// outside one (like this test file calling the function directly) it throws
// "after() was called outside a request scope". Mocked to invoke its
// callback immediately: findCompetitorsForProduct's own persist call has no
// internal await before its synchronous mocked upsert below runs, so this
// preserves the exact same observable timing (upsertedMatchRows populated by
// the time the function resolves) the tests below already rely on.
vi.mock('next/server', () => ({
  after: (callback: () => void) => callback(),
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
  reviewRows = [];
  sellerProductRow = { id: 'sp1', title: 'RTX 4070 GPU', sell_price: 100000, currency: 'PKR' };
});

describe('findCompetitorsForProduct', () => {
  it('excludes a candidate below the confidence threshold even at an identical price', async () => {
    marketRows.push(marketRow({ title: 'Completely Unrelated Item Name', price: 100000, url: 'no-title-overlap' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result).toHaveLength(0);
  });

  it('includes a candidate with a very different price when title confidence is high', async () => {
    marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 999999, url: 'far-off-price' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result).toHaveLength(1);
    expect(result[0].matchedUrl).toBe('far-off-price');
  });

  it('ranks higher title-similarity matches first', async () => {
    marketRows.push(
      marketRow({ title: 'RTX 4070 GPU Variant', price: 95000, url: 'lower-similarity' }),
      marketRow({ title: 'RTX 4070 GPU', price: 105000, url: 'exact-title' }),
    );

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result).toHaveLength(2);
    expect(result[0].matchedUrl).toBe('exact-title');
  });

  it('passes rating/ratingCount/soldCount through as null, never coerced to 0', async () => {
    marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 100000, rating: null, sold_count: null, url: 'nulls' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result[0].rating).toBeNull();
    expect(result[0].soldCount).toBeNull();
  });

  it('persists the top matches into seller_product_competitor_matches, keyed by seller+market product', async () => {
    marketRows.push(marketRow({ id: 'mp-target', title: 'RTX 4070 GPU', price: 100000, url: 'match' }));

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

  it('returns an empty array and persists nothing when nothing meets the confidence threshold', async () => {
    marketRows.push(marketRow({ title: 'Totally Unrelated Product', price: 100000, url: 'no-match' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result).toHaveLength(0);
    expect(upsertedMatchRows).toHaveLength(0);
  });

  it('caps results at the given limit', async () => {
    for (let i = 0; i < 10; i++) {
      marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 100000, url: `listing-${i}` }));
    }

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus', 'PKR', 5);

    expect(result).toHaveLength(5);
  });

  it('round-robins across platforms so a dense platform cannot crowd out a smaller one', async () => {
    for (let i = 0; i < 10; i++) {
      marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 100000, url: `shopperspk-${i}`, market_platforms: { name: 'ShoppersPK' } }));
    }
    marketRows.push(
      marketRow({ title: 'RTX 4070 GPU', price: 100000, url: 'daraz-1', market_platforms: { name: 'Daraz' } }),
      marketRow({ title: 'RTX 4070 GPU', price: 100000, url: 'daraz-2', market_platforms: { name: 'Daraz' } }),
    );

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus', 'PKR', 5);

    const platforms = result.map((r) => r.matchedPlatformName);
    expect(platforms).toContain('Daraz');
    expect(platforms.filter((p) => p === 'Daraz')).toHaveLength(2);
  });

  it('attaches review count and up to 2 snippets when reviews have been scraped for a match', async () => {
    marketRows.push(marketRow({ id: 'mp-reviewed', title: 'RTX 4070 GPU', price: 100000, url: 'reviewed' }));
    reviewRows = [
      { product_id: 'mp-reviewed', author: 'Ali', rating: 5, review_text: 'Great card' },
      { product_id: 'mp-reviewed', author: null, rating: 4, review_text: 'Good value' },
      { product_id: 'mp-reviewed', author: 'Sana', rating: 3, review_text: 'Runs hot' },
    ];

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result[0].reviewCount).toBe(3);
    expect(result[0].topReviews).toHaveLength(2);
    expect(result[0].topReviews[0]).toEqual({ author: 'Ali', rating: 5, text: 'Great card' });
  });

  it('defaults reviewCount to 0 and topReviews to an empty array when nothing has been scraped', async () => {
    marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 100000, url: 'no-reviews' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result[0].reviewCount).toBe(0);
    expect(result[0].topReviews).toEqual([]);
  });
});
