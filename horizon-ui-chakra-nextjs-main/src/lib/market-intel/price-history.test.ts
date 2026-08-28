import { describe, it, expect, vi } from 'vitest';

// getSellerPriceHistory (migration 030): reads seller_product_price_history,
// a table populated entirely by a DB trigger on seller_products - this
// function is a pure read, no write path to test here.

let historyRows: { sell_price: number | null; recorded_at: string }[] = [];
let seenFilters: { sellerId?: string; sellerProductId?: string } = {};

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'seller_product_price_history') {
        return {
          select: () => ({
            eq: (col: string, value: string) => {
              if (col === 'seller_id') seenFilters.sellerId = value;
              if (col === 'seller_product_id') seenFilters.sellerProductId = value;
              return {
                eq: (col2: string, value2: string) => {
                  if (col2 === 'seller_id') seenFilters.sellerId = value2;
                  if (col2 === 'seller_product_id') seenFilters.sellerProductId = value2;
                  return {
                    order: async (): Promise<{ data: typeof historyRows; error: null }> => ({
                      data: historyRows,
                      error: null,
                    }),
                  };
                },
              };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { getSellerPriceHistory } from './price-history';

describe('getSellerPriceHistory', () => {
  it('returns price points in ascending recorded_at order, mapped to camelCase', async () => {
    historyRows = [
      { sell_price: 1000, recorded_at: '2026-08-01T00:00:00Z' },
      { sell_price: 950, recorded_at: '2026-08-15T00:00:00Z' },
    ];
    const result = await getSellerPriceHistory('seller1', 'sp1');
    expect(result).toEqual([
      { sellPrice: 1000, recordedAt: '2026-08-01T00:00:00Z' },
      { sellPrice: 950, recordedAt: '2026-08-15T00:00:00Z' },
    ]);
  });

  it('returns an empty array for a product with no recorded history yet', async () => {
    historyRows = [];
    const result = await getSellerPriceHistory('seller1', 'sp-new');
    expect(result).toEqual([]);
  });

  it('scopes the query by both seller_id and seller_product_id', async () => {
    historyRows = [];
    seenFilters = {};
    await getSellerPriceHistory('seller42', 'sp99');
    expect(seenFilters).toEqual({ sellerId: 'seller42', sellerProductId: 'sp99' });
  });
});
