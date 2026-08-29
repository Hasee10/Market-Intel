import { describe, it, expect, vi } from 'vitest';

// getCompetitorMatchCounts (2026-08-28): reads the seller's already-accumulated
// seller_product_competitor_matches rows (persisted by product-matching.ts on
// every Competitors-drawer open) and rolls them up per named competitor, so
// the category-level Competitors scorecard can show "how many of my products
// have I actually matched against this seller" without recomputing anything.

let matchRows: any[] = [];
let matchedListingRows: any[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'seller_product_competitor_matches') {
        return {
          select: (columns: string) => {
            // getMatchedListingsForExport selects seller_products(title) too -
            // distinguish by column list rather than adding a second mocked
            // table, since both queries hit the same table.
            const rows = columns.includes('seller_products') ? matchedListingRows : matchRows;
            return {
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    in: () => ({
                      limit: async (): Promise<{ data: any[]; error: null }> => ({ data: rows, error: null }),
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

vi.mock('@/lib/market-intel/market-definition', () => ({
  getMarketScope: async () => ({ categorySlugs: ['gpus'], activePlatformIds: ['p1', 'p2'] }),
  getMarketScopeForAllDomains: async () => ({
    categorySlugs: ['gpus', 'phones'],
    activePlatformIds: ['p1', 'p2', 'p3'],
  }),
}));

import { getCompetitorMatchCounts, getCompetitorMatchCountsAllDomains, getMatchedListingsForExport } from './competitors';

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

function matchedListingRow(sellerTitle: string, marketTitle: string, platformName: string | null, price: number | null) {
  return {
    confidence: 0.85,
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
