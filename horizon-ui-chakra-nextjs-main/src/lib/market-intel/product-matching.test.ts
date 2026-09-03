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
    rpc: async (fn: string): Promise<{ data: any[]; error: null }> => {
      if (fn === 'market_top_similar_candidates') return { data: marketRows, error: null };
      throw new Error(`unexpected rpc ${fn}`);
    },
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

// Shape returned by the market_top_similar_candidates RPC (see
// candidate-search.ts) - flat, platform_name instead of a
// market_platforms(...) join, since a Postgres function returns a plain
// table, not a Supabase relational select.
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
  platform_id: string;
  platform_name: string;
  seller_external_id: string | null;
  similarity_score: number;
};

function marketRow(overrides: Partial<MarketRow> & { market_platforms?: { name: string } }): MarketRow {
  const { market_platforms, ...rest } = overrides;
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
    platform_id: 'p1',
    platform_name: market_platforms?.name ?? 'Daraz',
    seller_external_id: null,
    similarity_score: 0.5,
    ...rest,
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

  // Regression: selectDiverseTopN's round-robin output used to BE the render
  // order, so platform rotation outranked title relevance - the second
  // platform's weakest match could sit above the first platform's best.
  // Diversity must still decide which listings survive; it must not decide
  // what order they appear in.
  it('orders results by confidence, not by the platform round-robin that selected them', async () => {
    marketRows.push(
      marketRow({ title: 'RTX 4070 GPU', price: 100000, url: 'daraz-exact', market_platforms: { name: 'Daraz' } }),
      marketRow({
        title: 'RTX 4070 GPU Extra Words Diluting The Match',
        price: 100000,
        url: 'shopperspk-weak',
        market_platforms: { name: 'ShoppersPK' },
      }),
      marketRow({ title: 'RTX 4070 GPU', price: 100000, url: 'daraz-exact-2', market_platforms: { name: 'Daraz' } }),
    );

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    // Both platforms still represented - diversity is intact.
    expect(result.map((r) => r.matchedPlatformName)).toContain('ShoppersPK');
    // ...but the weaker ShoppersPK match must not outrank an exact Daraz one.
    const confidences = result.map((r) => r.confidence);
    expect(confidences).toEqual([...confidences].sort((a, b) => b - a));
    expect(result[0].matchedUrl).not.toBe('shopperspk-weak');
  });

  // Regression: sellerPrice/priceDiff were computed and then destructured
  // away in the return, so the drawer received two prices and no comparison
  // and could never say "you are 7% under".
  it('returns the seller price and a signed delta so the drawer can show the comparison', async () => {
    marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 125000, url: 'pricier-competitor' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result[0].sellerPrice).toBe(100000);
    // Seller at 100k vs listing at 125k = 20% below them.
    expect(result[0].priceDeltaPct).toBeCloseTo(-0.2, 5);
  });

  it('reports a positive delta when the seller is the more expensive one', async () => {
    marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 80000, url: 'cheaper-competitor' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result[0].priceDeltaPct).toBeCloseTo(0.25, 5);
  });

  it('leaves the delta null rather than guessing when the seller has no price set', async () => {
    sellerProductRow = { id: 'sp1', title: 'RTX 4070 GPU', sell_price: null, currency: 'PKR' };
    marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 100000, url: 'no-seller-price' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result[0].sellerPrice).toBeNull();
    expect(result[0].priceDeltaPct).toBeNull();
  });

  it('leaves the delta null when the listing price is zero rather than dividing by it', async () => {
    marketRows.push(marketRow({ title: 'RTX 4070 GPU', price: 0, url: 'zero-price' }));

    const result = await findCompetitorsForProduct('seller1', 'sp1', 'gpus');

    expect(result[0].priceDeltaPct).toBeNull();
  });

  // The reported bug, end to end: a candidate pool fetched for a Samsung
  // phone is full of Samsung phones, so "samsung" and "galaxy" carry no
  // information inside it - yet plain overlap counts them the same as the
  // model number. A listing sharing only the brand prefix outranked one
  // sharing the actual model. All candidates sit on one platform so the
  // round-robin cannot influence the order being asserted.
  describe('IDF-weighted ranking', () => {
    const samsungPool = [
      'Samsung Galaxy S24 Ultra',
      'Samsung Galaxy S23',
      'Samsung Galaxy Z Fold',
      'Samsung Galaxy Z Flip',
      'Samsung Galaxy A54',
      'Samsung Galaxy A34',
      'Samsung Galaxy M14',
    ];

    beforeEach(() => {
      sellerProductRow = { id: 'sp1', title: 'Samsung Galaxy A15', sell_price: 60000, currency: 'PKR' };
      samsungPool.forEach((title, i) =>
        marketRows.push(marketRow({ id: `mp-${i}`, title, price: 60000, url: `brand-only-${i}` })),
      );
      // Shares the model number but not the brand boilerplate. Plain jaccard
      // scores this 0.25 against the S24 Ultra's 0.4, so it ranked below.
      marketRows.push(
        marketRow({ id: 'mp-real', title: 'A15 Smartphone', price: 60000, url: 'same-model' }),
      );
    });

    it('ranks the listing sharing the model number above ones sharing only the brand', async () => {
      const result = await findCompetitorsForProduct('seller1', 'sp1', 'mobiles');

      expect(result[0].matchedUrl).toBe('same-model');
      // ...and it genuinely was the lower plain-confidence row, so this is
      // the weighting doing the work rather than the old ordering agreeing.
      const sameModel = result.find((r) => r.matchedUrl === 'same-model')!;
      const brandOnly = result.find((r) => r.matchedUrl === 'brand-only-0')!;
      expect(sameModel.confidence).toBeLessThan(brandOnly.confidence);
    });

    it('still includes the brand-prefix matches rather than filtering them out', async () => {
      const result = await findCompetitorsForProduct('seller1', 'sp1', 'mobiles');

      // Inclusion is deliberately unchanged - IDF re-ranks, it does not gate.
      expect(result).toHaveLength(samsungPool.length + 1);
    });

    it('bands the model match above the brand-only ones so a seller can see the difference', async () => {
      const result = await findCompetitorsForProduct('seller1', 'sp1', 'mobiles');

      const sameModel = result.find((r) => r.matchedUrl === 'same-model')!;
      const brandOnly = result.find((r) => r.matchedUrl === 'brand-only-0')!;

      expect(sameModel.matchStrength).not.toBe('loose');
      expect(brandOnly.matchStrength).toBe('loose');
    });
  });
});
