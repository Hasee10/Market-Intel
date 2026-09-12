import { describe, it, expect, vi, beforeEach } from 'vitest';

const productRows: any[] = [];
let primaryDomain: any = { categoryId: 'cat1', categorySlug: 'gpus', categoryName: 'GPUs' };
let marketScopeImpl: () => Promise<any> = async () => ({
  hasTaxonomy: true,
  activeSegments: [1],
  allSegments: [1, 2],
  definition: { isDefault: false, priceMin: null, priceMax: null, priceCurrency: 'PKR' },
});
let competitorLandscapeImpl: () => Promise<any> = async () => ({
  scorecards: [
    { name: 'RivalCo', platformName: 'Daraz', skuCount: 12, priceIndex: -0.08, inStockRate: 0.9 },
  ],
});
let watchlistsImpl: () => Promise<any> = async () => [];
const findCompetitorsForProductMock = vi.fn(async (..._args: any[]) => [
  { matchedTitle: 'Rival GPU', matchedPlatformName: 'Daraz', matchedPrice: 105000 },
]);

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'seller_products') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: async (): Promise<{ data: any[]; error: null }> => ({ data: productRows, error: null }),
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

vi.mock('@/lib/market-intel/seller/seller', () => ({
  getPrimaryDomain: async () => primaryDomain,
}));

vi.mock('@/lib/market-intel/market/market-definition', () => ({
  getMarketScope: async () => marketScopeImpl(),
}));

vi.mock('@/lib/market-intel/market/competitors', () => ({
  getCompetitorLandscape: async () => competitorLandscapeImpl(),
}));

vi.mock('@/lib/market-intel/seller/watchlists', () => ({
  listWatchlists: async () => watchlistsImpl(),
}));

vi.mock('@/lib/market-intel/market/product-matching', () => ({
  findCompetitorsForProduct: (...args: any[]) => findCompetitorsForProductMock(...args),
}));

import { buildSellerContextBlock } from './seller-assistant-context';

const seller: any = { id: 'seller1', businessName: 'Test Store', reportingCurrency: 'PKR' };

beforeEach(() => {
  productRows.length = 0;
  primaryDomain = { categoryId: 'cat1', categorySlug: 'gpus', categoryName: 'GPUs' };
  marketScopeImpl = async () => ({
    hasTaxonomy: true,
    activeSegments: [1],
    allSegments: [1, 2],
    definition: { isDefault: false, priceMin: null, priceMax: null, priceCurrency: 'PKR' },
  });
  competitorLandscapeImpl = async () => ({
    scorecards: [{ name: 'RivalCo', platformName: 'Daraz', skuCount: 12, priceIndex: -0.08, inStockRate: 0.9 }],
  });
  watchlistsImpl = async () => [];
  findCompetitorsForProductMock.mockClear();
});

describe('buildSellerContextBlock', () => {
  it('assembles products, market scope, competitor landscape, and watchlist sections on the happy path', async () => {
    productRows.push({
      id: 'sp1',
      sku: 'SKU1',
      title: 'RTX 4070 GPU',
      sell_price: 100000,
      cost_price: 80000,
      currency: 'PKR',
      stock_qty: 5,
    });

    const block = await buildSellerContextBlock(seller, 'how is business going');

    expect(block).toContain('RTX 4070 GPU');
    expect(block).toContain('RivalCo');
    expect(block).toContain('Watchlist: empty.');
    expect(block.length).toBeLessThanOrEqual(4000);
  });

  it('degrades gracefully when one source throws, without throwing itself', async () => {
    productRows.push({
      id: 'sp1',
      sku: 'SKU1',
      title: 'RTX 4070 GPU',
      sell_price: 100000,
      cost_price: 80000,
      currency: 'PKR',
      stock_qty: 5,
    });
    marketScopeImpl = async () => {
      throw new Error('boom');
    };

    const block = await buildSellerContextBlock(seller, 'how is business going');

    expect(block).toContain('Market definition: unavailable right now.');
    expect(block).toContain('RTX 4070 GPU');
  });

  it('reports no products without crashing when the seller has none', async () => {
    const block = await buildSellerContextBlock(seller, 'how is business going');

    expect(block).toContain('Store products: none added yet.');
  });

  it('only runs the per-product competitor lookup when the message plausibly names a known product', async () => {
    productRows.push({
      id: 'sp1',
      sku: 'SKU1',
      title: 'RTX 4070 GPU',
      sell_price: 100000,
      cost_price: 80000,
      currency: 'PKR',
      stock_qty: 5,
    });

    await buildSellerContextBlock(seller, 'how is my overall margin doing this month');
    expect(findCompetitorsForProductMock).not.toHaveBeenCalled();

    await buildSellerContextBlock(seller, 'how is the RTX 4070 GPU doing against competitors');
    expect(findCompetitorsForProductMock).toHaveBeenCalledTimes(1);
  });
});
