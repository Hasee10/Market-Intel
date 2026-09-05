import { describe, it, expect, vi } from 'vitest';

// Regression coverage for two real bugs fixed in getCompetitorLandscape
// (code audit, 2026-08-29; migration 040):
//
//   1. market_competitor_scorecards used to be called with no price-band/
//      brand/city params at all, while the market-median RPC right below it
//      always got the full scope.definition - so price_index divided two
//      differently-scoped populations whenever a seller had a price band
//      set. Test below asserts the scorecards RPC receives the same band
//      params as the median RPC.
//   2. identifiedSkuCount used to be summed from only the p_limit=25
//      *returned* rows, undercounting (and inflating every assortmentShare)
//      whenever more than 25 sellers were identified in scope. Test below
//      gives a total_identified_sku_count larger than the sum of the
//      returned rows' sku_count, and asserts the larger SQL-computed total
//      wins, not the client-side sum.

let scorecardsCallParams: any = null;

const SCOPE_DEFINITION = {
  priceCurrency: 'PKR',
  priceMin: 10000,
  priceMax: 50000,
  brands: ['Samsung'],
  cities: ['Karachi'],
  sellerCategorySlug: 'mobiles-and-electronics',
  includedSegments: [] as string[],
  excludedPlatformIds: [] as string[],
  isDefault: false,
};

vi.mock('@/lib/market-intel/market/market-definition', () => ({
  getMarketScope: async () => ({
    sellerCategorySlug: 'mobiles-and-electronics',
    definition: SCOPE_DEFINITION,
    allSegments: [] as unknown[],
    activeSegments: [] as unknown[],
    categorySlugs: ['mobiles-smartphones'],
    activePlatformIds: ['platform-1'],
    hasTaxonomy: true,
    matchesCategory: () => true,
    matchesRow: () => true,
  }),
}));

vi.mock('@/lib/market-intel/fx', () => ({
  getLatestFxRates: async () => ({ PKR: 1 }),
  convertCurrency: (amount: number) => amount,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    // Not `async` deliberately: the real supabase-js client returns a
    // thenable query builder from .rpc() that supports chaining .maybeSingle()
    // *before* it's awaited (getScopeMedianPrice does exactly that). An
    // async function here would return a plain Promise instead, which has
    // no .maybeSingle method.
    rpc: (fn: string, params: any) => {
      if (fn === 'market_competitor_scorecards') {
        scorecardsCallParams = params;
        return {
          data: [
            // Only 2 rows "returned" (simulating the p_limit cutoff), but
            // total_identified_sku_count reflects the true total across
            // every identified competitor - larger than 3+5=8.
            { competitor_id: 'c1', external_id: 'seller-1', name: 'Seller One', platform_name: 'Daraz', sku_count: 5, brand_count: 1, category_count: 1, min_price: 100, median_price: 110, max_price: 120, in_stock_rate: 1, sold_units: 10, avg_rating: 4.5, rated_sku_count: 5, price_change_rate: 0.1, observed_sku_count: 5, first_seen_at: null as string | null, last_seen_at: null as string | null, total_identified_sku_count: 250 },
            { competitor_id: 'c2', external_id: 'seller-2', name: 'Seller Two', platform_name: 'Daraz', sku_count: 3, brand_count: 1, category_count: 1, min_price: 90, median_price: 100, max_price: 110, in_stock_rate: 1, sold_units: 5, avg_rating: 4.0, rated_sku_count: 3, price_change_rate: 0, observed_sku_count: 3, first_seen_at: null as string | null, last_seen_at: null as string | null, total_identified_sku_count: 250 },
          ],
          error: null as null,
        };
      }
      if (fn === 'market_scope_price_stats') {
        return { maybeSingle: async () => ({ data: { median: 105 }, error: null as null }) };
      }
      throw new Error(`unexpected rpc ${fn}`);
    },
    from: (table: string) => {
      if (table === 'market_products') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                in: () => ({
                  in: async () => ({ count: 40, error: null as null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { getCompetitorLandscape } from './competitors';

describe('getCompetitorLandscape', () => {
  it('passes the full market definition (price band, brands, cities) to market_competitor_scorecards', async () => {
    await getCompetitorLandscape('mobiles-and-electronics', 'PKR');

    expect(scorecardsCallParams.p_price_min).toBe(SCOPE_DEFINITION.priceMin);
    expect(scorecardsCallParams.p_price_max).toBe(SCOPE_DEFINITION.priceMax);
    expect(scorecardsCallParams.p_band_currency).toBe(SCOPE_DEFINITION.priceCurrency);
    expect(scorecardsCallParams.p_brands).toEqual(SCOPE_DEFINITION.brands);
    expect(scorecardsCallParams.p_cities).toEqual(SCOPE_DEFINITION.cities);
  });

  it('uses the SQL-computed total_identified_sku_count, not a client-side sum of the returned page', async () => {
    const landscape = await getCompetitorLandscape('mobiles-and-electronics', 'PKR');

    expect(landscape.identifiedSkuCount).toBe(250);
    expect(landscape.identifiedSkuCount).not.toBe(5 + 3); // the old, wrong behaviour

    // assortmentShare is derived from identifiedSkuCount, so this is where
    // the old bug actually surfaced to a seller: with the wrong (too small)
    // denominator, every competitor's share was inflated.
    const seller1 = landscape.scorecards.find((s) => s.externalId === 'seller-1')!;
    expect(seller1.assortmentShare).toBeCloseTo(5 / 250);
  });
});
