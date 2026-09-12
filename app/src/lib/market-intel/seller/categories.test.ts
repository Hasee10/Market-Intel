import { describe, it, expect, beforeEach, vi } from 'vitest';

type Resp = { data: any; error: { message: string } | null };
const responses: Record<string, Resp> = {};

function fakeTable(table: string) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    then: (resolve: (v: Resp) => void) => resolve(responses[table] ?? { data: [], error: null }),
  };
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: (table: string) => fakeTable(table) }),
}));

import { getSellerCategories } from './categories';

beforeEach(() => {
  responses['seller_categories'] = { data: [], error: null };
  responses['seller_products'] = { data: [], error: null };
});

describe('getSellerCategories', () => {
  it('throws when the categories query errors', async () => {
    responses['seller_categories'] = { data: null, error: { message: 'relation missing' } };
    await expect(getSellerCategories('seller1')).rejects.toThrow('relation missing');
  });

  it('throws when the products query errors, even if categories succeeded', async () => {
    responses['seller_products'] = { data: null, error: { message: 'timeout' } };
    await expect(getSellerCategories('seller1')).rejects.toThrow('timeout');
  });

  it('counts products per category and zero-fills categories with none', async () => {
    responses['seller_categories'] = {
      data: [
        { id: 'c1', slug: 'beauty', name: 'Beauty' },
        { id: 'c2', slug: 'toys', name: 'Toys' },
      ],
      error: null,
    };
    responses['seller_products'] = {
      data: [{ category_id: 'c1' }, { category_id: 'c1' }, { category_id: null }],
      error: null,
    };

    const categories = await getSellerCategories('seller1');
    expect(categories.find((c) => c.id === 'c1')?.productCount).toBe(2);
    expect(categories.find((c) => c.id === 'c2')?.productCount).toBe(0);
  });
});
