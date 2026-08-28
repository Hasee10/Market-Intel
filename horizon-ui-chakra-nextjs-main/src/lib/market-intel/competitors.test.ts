import { describe, it, expect, vi } from 'vitest';

// getCompetitorMatchCounts (2026-08-28): reads the seller's already-accumulated
// seller_product_competitor_matches rows (persisted by product-matching.ts on
// every Competitors-drawer open) and rolls them up per named competitor, so
// the category-level Competitors scorecard can show "how many of my products
// have I actually matched against this seller" without recomputing anything.

let matchRows: any[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'seller_product_competitor_matches') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  in: () => ({
                    limit: async (): Promise<{ data: any[]; error: null }> => ({ data: matchRows, error: null }),
                  }),
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

vi.mock('@/lib/market-intel/market-definition', () => ({
  getMarketScope: async () => ({ categorySlugs: ['gpus'], activePlatformIds: ['p1', 'p2'] }),
}));

import { getCompetitorMatchCounts } from './competitors';

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

  it('returns an empty map without calling Supabase when categorySlugs is empty', async () => {
    vi.doMock('@/lib/market-intel/market-definition', () => ({
      getMarketScope: async () => ({ categorySlugs: [] as string[], activePlatformIds: [] as string[] }),
    }));
    vi.resetModules();
    const { getCompetitorMatchCounts: fn } = await import('./competitors');
    const result = await fn('seller1', 'gpus');
    expect(result.size).toBe(0);
  });
});
