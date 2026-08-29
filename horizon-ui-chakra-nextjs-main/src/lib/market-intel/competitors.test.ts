import { describe, it, expect, vi } from 'vitest';

// getCompetitorMatchCounts (2026-08-28): reads the seller's already-accumulated
// seller_product_competitor_matches rows (persisted by product-matching.ts on
// every Competitors-drawer open) and rolls them up per named competitor, so
// the category-level Competitors scorecard can show "how many of my products
// have I actually matched against this seller" without recomputing anything.

let matchRows: any[] = [];
let matchedListingRows: any[] = [];
let sellerProductRows: any[] = [];
let overlapRpcRowsByTitle: Record<string, any[]> = {};

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (fn: string, params: any): Promise<{ data: any[]; error: null }> => {
      if (fn !== 'market_top_similar_candidates') throw new Error(`unexpected rpc ${fn}`);
      return { data: overlapRpcRowsByTitle[params.p_query_title] ?? [], error: null };
    },
    from: (table: string) => {
      if (table === 'seller_products') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                not: () => ({
                  order: () => ({
                    limit: async (): Promise<{ data: any[]; error: null }> => ({ data: sellerProductRows, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'seller_product_competitor_matches') {
        return {
          select: (columns: string) => {
            // getMatchedListingsForExport selects seller_products(title) too -
            // distinguish by column list rather than adding a second mocked
            // table, since both queries hit the same table. It also adds a
            // .gte('confidence', ...) call getCompetitorMatchCounts doesn't
            // have, so the two need different mocked chains - the mock
            // actually filters matchedListingRows by the threshold passed,
            // simulating the real WHERE clause, so the fix is genuinely
            // exercised rather than just typechecked.
            if (columns.includes('seller_products')) {
              return {
                eq: () => ({
                  gte: (_col: string, threshold: number) => ({
                    eq: () => ({
                      in: () => ({
                        in: () => ({
                          limit: async (): Promise<{ data: any[]; error: null }> => ({
                            data: matchedListingRows.filter((r) => Number(r.confidence) >= threshold),
                            error: null,
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
              };
            }
            return {
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    in: () => ({
                      limit: async (): Promise<{ data: any[]; error: null }> => ({ data: matchRows, error: null }),
                    }),
                  }),
                }),
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock('@/lib/market-intel/fx', () => ({
  getLatestFxRates: async () => ({ PKR: 1 }),
  convertCurrency: (amount: number) => amount,
}));

vi.mock('@/lib/market-intel/market-definition', () => ({
  getMarketScope: async () => ({ categorySlugs: ['gpus'], activePlatformIds: ['p1', 'p2'] }),
  getMarketScopeForAllDomains: async () => ({
    categorySlugs: ['gpus', 'phones'],
    activePlatformIds: ['p1', 'p2', 'p3'],
  }),
}));

import {
  getCompetitorMatchCounts,
  getCompetitorMatchCountsAllDomains,
  getCompetitorOverlap,
  getMatchedListingsForExport,
} from './competitors';

function row(sellerProductId: string, sellerExternalId: string | null) {
  return {
    seller_product_id: sellerProductId,
    market_products: {
      platform_id: 'p1',
      seller_external_id: sellerExternalId,
      category_slug: 'gpus',
      is_active: true,
    },
  };
}

describe('getCompetitorMatchCounts', () => {
  it('counts distinct seller products matched per competitor', async () => {
    matchRows = [row('sp1', 'daraz-seller-a'), row('sp2', 'daraz-seller-a')];
    const result = await getCompetitorMatchCounts('seller1', 'gpus');
    expect(result.get('daraz-seller-a')).toEqual({ externalId: 'daraz-seller-a', matchedProductCount: 2 });
  });

  it('dedupes a seller product matched to two market_products from the same competitor', async () => {
    matchRows = [row('sp1', 'daraz-seller-a'), row('sp1', 'daraz-seller-a')];
    const result = await getCompetitorMatchCounts('seller1', 'gpus');
    expect(result.get('daraz-seller-a')?.matchedProductCount).toBe(1);
  });

  it('skips rows with no seller_external_id without throwing', async () => {
    matchRows = [row('sp1', null), row('sp2', 'daraz-seller-a')];
    const result = await getCompetitorMatchCounts('seller1', 'gpus');
    expect(result.size).toBe(1);
    expect(result.get('daraz-seller-a')?.matchedProductCount).toBe(1);
  });

});

describe('getCompetitorMatchCountsAllDomains', () => {
  it('rolls up matches the same way as the single-domain version, using the unioned scope', async () => {
    matchRows = [row('sp1', 'daraz-seller-a'), row('sp2', 'daraz-seller-a')];
    const result = await getCompetitorMatchCountsAllDomains('seller1');
    expect(result.get('daraz-seller-a')).toEqual({ externalId: 'daraz-seller-a', matchedProductCount: 2 });
  });
});

function matchedListingRow(
  sellerTitle: string,
  marketTitle: string,
  platformName: string | null,
  price: number | null,
  confidence = 0.85,
) {
  return {
    confidence,
    seller_products: { title: sellerTitle },
    market_products: {
      title: marketTitle,
      price,
      currency: 'PKR',
      url: `https://example.com/${marketTitle}`,
      market_platforms: platformName ? { name: platformName } : null,
    },
  };
}

describe('getMatchedListingsForExport', () => {
  const scope = { categorySlugs: ['gpus'], activePlatformIds: ['p1'] } as any;

  it('maps each matched row to a flat listing for CSV export', async () => {
    matchedListingRows = [matchedListingRow('My GPU', 'Competitor GPU', 'Daraz', 45000)];
    const result = await getMatchedListingsForExport('seller1', scope);
    expect(result).toEqual([
      {
        sellerProductTitle: 'My GPU',
        matchedTitle: 'Competitor GPU',
        matchedPlatformName: 'Daraz',
        matchedPrice: 45000,
        matchedCurrency: 'PKR',
        matchedUrl: 'https://example.com/Competitor GPU',
        confidence: 0.85,
      },
    ]);
  });

  it('skips rows missing either side of the join rather than throwing', async () => {
    matchedListingRows = [
      { confidence: 0.9, seller_products: null, market_products: matchedListingRow('x', 'y', 'Daraz', 1).market_products },
      matchedListingRow('Real Product', 'Real Match', null, null),
    ];
    const result = await getMatchedListingsForExport('seller1', scope);
    expect(result).toHaveLength(1);
    expect(result[0].sellerProductTitle).toBe('Real Product');
    expect(result[0].matchedPlatformName).toBeNull();
    expect(result[0].matchedPrice).toBeNull();
  });

  it('returns an empty array without querying anything when the scope has no categories', async () => {
    const result = await getMatchedListingsForExport('seller1', { categorySlugs: [], activePlatformIds: [] } as any);
    expect(result).toEqual([]);
  });

  it('excludes a stale persisted match below MIN_COMPETITOR_CONFIDENCE', async () => {
    // Regression test: a real exported CSV showed "Avalanche Fruity" matched
    // against a Gillette razor at confidence 0 - a persisted row gone stale
    // after the matched market_products row's title changed on a later
    // scrape (see this function's own comment for the full mechanism).
    matchedListingRows = [
      matchedListingRow('Avalanche Fruity', 'Gillette Skin Guard Razor', "Naheed.pk", 2600, 0),
      matchedListingRow('My GPU', 'Competitor GPU', 'Daraz', 45000, 0.85),
    ];
    const result = await getMatchedListingsForExport('seller1', scope);
    expect(result).toHaveLength(1);
    expect(result[0].sellerProductTitle).toBe('My GPU');
  });
});

describe('getCompetitorOverlap', () => {
  it('counts overlap and win/loss for the best-matching candidate per competitor', async () => {
    sellerProductRows = [{ id: 'sp1', title: 'RTX 4070 GPU', sell_price: 90000, currency: 'PKR' }];
    overlapRpcRowsByTitle = {
      'RTX 4070 GPU': [
        { title: 'RTX 4070 GPU', price: 100000, currency: 'PKR', seller_external_id: 'daraz-seller-a' },
      ],
    };

    const result = await getCompetitorOverlap('seller1', 'gpus', 'PKR');

    expect(result.get('daraz-seller-a')).toMatchObject({ overlapCount: 1, winCount: 1, lossCount: 0 });
  });

  it('excludes candidates with no seller_external_id (anonymous single-retailer listings)', async () => {
    sellerProductRows = [{ id: 'sp1', title: 'RTX 4070 GPU', sell_price: 90000, currency: 'PKR' }];
    overlapRpcRowsByTitle = {
      'RTX 4070 GPU': [{ title: 'RTX 4070 GPU', price: 100000, currency: 'PKR', seller_external_id: null }],
    };

    const result = await getCompetitorOverlap('seller1', 'gpus', 'PKR');

    expect(result.size).toBe(0);
  });

  it('only counts the best match per competitor, not every candidate row', async () => {
    sellerProductRows = [{ id: 'sp1', title: 'RTX 4070 GPU', sell_price: 90000, currency: 'PKR' }];
    overlapRpcRowsByTitle = {
      'RTX 4070 GPU': [
        { title: 'RTX 4070 GPU', price: 95000, currency: 'PKR', seller_external_id: 'daraz-seller-a' },
        { title: 'RTX 4070 GPU Variant', price: 105000, currency: 'PKR', seller_external_id: 'daraz-seller-a' },
      ],
    };

    const result = await getCompetitorOverlap('seller1', 'gpus', 'PKR');

    expect(result.get('daraz-seller-a')?.overlapCount).toBe(1);
  });

  it('calls the candidate RPC once per seller product with that product\'s own title', async () => {
    sellerProductRows = [
      { id: 'sp1', title: 'RTX 4070 GPU', sell_price: 90000, currency: 'PKR' },
      { id: 'sp2', title: 'RTX 4080 GPU', sell_price: 150000, currency: 'PKR' },
    ];
    overlapRpcRowsByTitle = {
      'RTX 4070 GPU': [{ title: 'RTX 4070 GPU', price: 100000, currency: 'PKR', seller_external_id: 'a' }],
      'RTX 4080 GPU': [{ title: 'RTX 4080 GPU', price: 140000, currency: 'PKR', seller_external_id: 'b' }],
    };

    const result = await getCompetitorOverlap('seller1', 'gpus', 'PKR');

    expect(result.get('a')?.overlapCount).toBe(1);
    expect(result.get('b')?.overlapCount).toBe(1);
  });

  it('returns an empty map when the seller has no products', async () => {
    sellerProductRows = [];
    overlapRpcRowsByTitle = {};

    const result = await getCompetitorOverlap('seller1', 'gpus', 'PKR');

    expect(result.size).toBe(0);
  });
});

describe('getCompetitorMatchCounts (empty scope)', () => {
  it('returns an empty map without calling Supabase when categorySlugs is empty', async () => {
    vi.doMock('@/lib/market-intel/market-definition', () => ({
      getMarketScope: async () => ({ categorySlugs: [] as string[], activePlatformIds: [] as string[] }),
      getMarketScopeForAllDomains: async () => ({ categorySlugs: [] as string[], activePlatformIds: [] as string[] }),
    }));
    vi.resetModules();
    const { getCompetitorMatchCounts: fn } = await import('./competitors');
    const result = await fn('seller1', 'gpus');
    expect(result.size).toBe(0);
  });
});
