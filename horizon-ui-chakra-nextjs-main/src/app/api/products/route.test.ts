import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let currentSeller: any = { id: 'seller1', country: 'PK', reportingCurrency: 'PKR' };
const categoryRows = [
  { id: 'cat-mobiles', slug: 'mobiles-and-electronics', name: 'Mobiles & Electronics' },
  { id: 'cat-home', slug: 'home-and-kitchen', name: 'Home & Kitchen' },
];
let insertedRow: any = null;
const suggestCategoryMock = vi.fn(async (..._args: any[]) => ({ categorySlug: 'mobiles-and-electronics', confidence: 'high' }));

vi.mock('@/lib/market-intel/seller/seller', () => ({
  getCurrentSeller: async () => currentSeller,
}));

vi.mock('@/lib/ai/suggest-category', () => ({
  suggestCategory: (...args: any[]) => suggestCategoryMock(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'seller_categories') {
        return {
          select: async (): Promise<{ data: any[]; error: null }> => ({ data: categoryRows, error: null }),
        };
      }
      if (table === 'seller_products') {
        return {
          insert: (row: any) => ({
            select: () => ({
              single: async (): Promise<{ data: any; error: null }> => {
                insertedRow = { id: 'sp1', ...row, seller_categories: null };
                return { data: insertedRow, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from './route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/products', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  currentSeller = { id: 'seller1', country: 'PK', reportingCurrency: 'PKR' };
  insertedRow = null;
  suggestCategoryMock.mockClear();
  suggestCategoryMock.mockImplementation(async () => ({ categorySlug: 'mobiles-and-electronics', confidence: 'high' }));
});

describe('POST /api/products', () => {
  it('auto-assigns a category via suggestCategory when none is provided', async () => {
    const response = await POST(makeRequest({ title: 'iPhone 15' }));
    const data = await response.json();

    expect(suggestCategoryMock).toHaveBeenCalledWith(
      'iPhone 15',
      expect.arrayContaining([expect.objectContaining({ slug: 'mobiles-and-electronics' })]),
    );
    expect(insertedRow.category_id).toBe('cat-mobiles');
    expect(data.succeeded).toBe(true);
  });

  it('keeps an explicitly provided categoryId instead of calling suggestCategory', async () => {
    await POST(makeRequest({ title: 'iPhone 15', categoryId: 'cat-home' }));

    expect(suggestCategoryMock).not.toHaveBeenCalled();
    expect(insertedRow.category_id).toBe('cat-home');
  });

  it('falls back to a null category when suggestCategory throws, without failing the request', async () => {
    suggestCategoryMock.mockRejectedValueOnce(new Error('groq down'));

    const response = await POST(makeRequest({ title: 'iPhone 15' }));
    const data = await response.json();

    expect(data.succeeded).toBe(true);
    expect(insertedRow.category_id).toBeNull();
  });

  it('does not call suggestCategory when there is no title', async () => {
    await POST(makeRequest({}));
    expect(suggestCategoryMock).not.toHaveBeenCalled();
  });

  // New with the zod validation - {} previously reached the insert with
  // title: undefined instead of failing cleanly.
  it('rejects a missing title with a 400 instead of inserting title: undefined', async () => {
    const response = await POST(makeRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.succeeded).toBe(false);
    expect(insertedRow).toBeNull();
  });

  it('rejects a negative sellPrice - the old code accepted any number', async () => {
    const response = await POST(makeRequest({ title: 'iPhone 15', sellPrice: -100 }));
    expect(response.status).toBe(400);
  });

  it('treats a blank sku/categoryId the same as omitting them (NewProductDrawer always sends "")', async () => {
    await POST(makeRequest({ title: 'iPhone 15', sku: '', categoryId: '' }));

    expect(insertedRow.sku).toBeNull();
    // categoryId '' -> null falls through to the auto-suggest path, which
    // the mock resolves to cat-mobiles - this asserts the blank string
    // didn't fail validation as "too short", not the suggestion outcome.
    expect(suggestCategoryMock).toHaveBeenCalled();
  });
});
