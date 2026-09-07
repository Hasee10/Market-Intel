import { describe, it, expect, beforeEach, vi } from 'vitest';

// Same regression class as overview.test.ts: a genuine Supabase error must
// throw (so the route can still 500 with a real message), and
// data: null / error: null must still resolve to an empty list rather than
// throwing a raw TypeError from .map() on null.

type Resp = { data: any; error: { message: string } | null };
let response: Resp = { data: [], error: null };
let rpcResponse: Resp = { data: [], error: null };

function fakeBuilder() {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    then: (resolve: (v: Resp) => void) => resolve(response),
  };
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => fakeBuilder(),
    rpc: async () => rpcResponse,
  }),
}));

import { getSellerProducts } from './products';

beforeEach(() => {
  response = { data: [], error: null };
  rpcResponse = { data: [], error: null };
});

describe('getSellerProducts', () => {
  it('throws the underlying Supabase error message rather than swallowing it', async () => {
    response = { data: null, error: { message: 'permission denied for table seller_products' } };
    await expect(getSellerProducts('seller1', null)).rejects.toThrow('permission denied for table seller_products');
  });

  it('returns an empty list rather than throwing when data is null with no error', async () => {
    response = { data: null, error: null };
    await expect(getSellerProducts('seller1', null)).resolves.toEqual([]);
  });

  it('maps a row to IProduct shape, including the category join', async () => {
    response = {
      data: [
        {
          id: 'p1',
          sku: 'SKU-1',
          title: 'Widget',
          category_id: 'c1',
          cost_price: 100,
          sell_price: 150,
          currency: 'PKR',
          stock_qty: 5,
          is_active: true,
          image_url: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-02',
          seller_categories: { name: 'Widgets' },
        },
      ],
      error: null,
    };

    const [product] = await getSellerProducts('seller1', null);
    expect(product.categoryName).toBe('Widgets');
    expect(product.sku).toBe('SKU-1');
  });
});
