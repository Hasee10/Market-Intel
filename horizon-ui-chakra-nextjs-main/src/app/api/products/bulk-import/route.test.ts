import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let currentSeller: any = { id: 'seller1', country: 'PK', reportingCurrency: 'PKR' };
const categoryRows = [
  { id: 'cat-mobiles', slug: 'mobiles-and-electronics', name: 'Mobiles & Electronics' },
  { id: 'cat-home', slug: 'home-and-kitchen', name: 'Home & Kitchen' },
];
const upsertedBatches: any[][] = [];
let categoriesAvailable = true;
const suggestCategoriesBatchMock = vi.fn(async (...args: any[]) =>
  (args[0] as string[]).map(() => ({ categorySlug: 'mobiles-and-electronics', confidence: 'high' as const })),
);

const autoAssignDomainsMock = vi.fn(async (...args: any[]) => ({
  added: [] as string[],
  skippedNeedsPremium: [] as string[],
}));

vi.mock('@/lib/market-intel/seller/seller', () => ({
  getCurrentSeller: async () => currentSeller,
  autoAssignDomainsForCategories: (...args: any[]) => autoAssignDomainsMock(...args),
}));

vi.mock('@/lib/ai/suggest-category', () => ({
  suggestCategoriesBatch: (...args: any[]) => suggestCategoriesBatchMock(...args),
  GroqNotConfiguredError: class GroqNotConfiguredError extends Error {},
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'seller_categories') {
        return {
          select: async (): Promise<{ data: any[]; error: null }> => ({
            data: categoriesAvailable ? categoryRows : [],
            error: null,
          }),
        };
      }
      if (table === 'seller_products') {
        return {
          upsert: (rows: any[]): Promise<{ error: null }> => {
            upsertedBatches.push(rows);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from './route';

function makeRequest(rows: unknown[]): NextRequest {
  return new NextRequest('http://localhost/api/products/bulk-import', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}

beforeEach(() => {
  currentSeller = { id: 'seller1', country: 'PK', reportingCurrency: 'PKR' };
  categoriesAvailable = true;
  upsertedBatches.length = 0;
  suggestCategoriesBatchMock.mockClear();
  autoAssignDomainsMock.mockClear();
  suggestCategoriesBatchMock.mockImplementation(async (titles: string[]) =>
    titles.map(() => ({ categorySlug: 'mobiles-and-electronics', confidence: 'high' as const })),
  );
});

describe('POST /api/products/bulk-import', () => {
  it('auto-categorizes rows that have no categoryId', async () => {
    const response = await POST(makeRequest([{ sku: 'A1', title: 'iPhone 15' }]));
    const data = await response.json();

    expect(suggestCategoriesBatchMock).toHaveBeenCalledWith(
      ['iPhone 15'],
      expect.arrayContaining([expect.objectContaining({ slug: 'mobiles-and-electronics' })]),
    );
    const upserted = upsertedBatches.flat();
    expect(upserted[0].category_id).toBe('cat-mobiles');
    expect(data.data.leftUncategorized).toBe(0);
  });

  it('does not call suggestCategoriesBatch for rows that already have a categoryId', async () => {
    await POST(makeRequest([{ sku: 'A1', title: 'iPhone 15', categoryId: 'cat-home' }]));

    expect(suggestCategoriesBatchMock).not.toHaveBeenCalled();
    expect(upsertedBatches.flat()[0].category_id).toBe('cat-home');
  });

  it('leaves rows uncategorized and reports the count when seller_categories is empty', async () => {
    categoriesAvailable = false;

    const response = await POST(makeRequest([{ sku: 'A1', title: 'iPhone 15' }]));
    const data = await response.json();

    expect(suggestCategoriesBatchMock).not.toHaveBeenCalled();
    expect(upsertedBatches.flat()[0].category_id).toBeNull();
    expect(data.data.leftUncategorized).toBe(1);
  });

  it('stops calling Groq after a GroqNotConfiguredError and leaves remaining rows uncategorized', async () => {
    suggestCategoriesBatchMock.mockRejectedValue(new (class GroqNotConfiguredError extends Error {})());

    const rows = Array.from({ length: 30 }, (_, i) => ({ sku: `A${i}`, title: `Product ${i}` }));
    const response = await POST(makeRequest(rows));
    const data = await response.json();

    expect(data.data.leftUncategorized).toBe(30);
    expect(upsertedBatches.flat().every((r: any) => r.category_id === null)).toBe(true);
  });

  it('existing SKU/no-SKU upsert split is unaffected by categorization', async () => {
    await POST(
      makeRequest([
        { sku: 'A1', title: 'Has a SKU' },
        { title: 'No SKU here' },
      ]),
    );

    // Two separate upsert calls: one for the SKU row (seller_id,sku conflict
    // target), one for the no-SKU row (seller_id,import_key) - unchanged by
    // the categorization step running first.
    expect(upsertedBatches).toHaveLength(2);
    expect(upsertedBatches[0]).toHaveLength(1);
    expect(upsertedBatches[1]).toHaveLength(1);
  });

  it('auto-assigns a domain for every distinct category the imported rows landed in', async () => {
    await POST(
      makeRequest([
        { sku: 'A1', title: 'Has a SKU', categoryId: 'cat-mobiles' },
        { sku: 'A2', title: 'Second mobiles item', categoryId: 'cat-mobiles' },
        { title: 'No SKU here', categoryId: 'cat-home' },
      ]),
    );

    expect(autoAssignDomainsMock).toHaveBeenCalledTimes(1);
    const [, categoryIds] = autoAssignDomainsMock.mock.calls[0];
    expect(categoryIds).toHaveLength(3);
    expect(new Set(categoryIds)).toEqual(new Set(['cat-mobiles', 'cat-home']));
  });

  it('surfaces domainsAdded/domainsNeedingPremium from the auto-assign result', async () => {
    autoAssignDomainsMock.mockResolvedValueOnce({ added: ['cat-mobiles'], skippedNeedsPremium: ['cat-home'] });

    const response = await POST(makeRequest([{ sku: 'A1', title: 'iPhone 15', categoryId: 'cat-mobiles' }]));
    const data = await response.json();

    expect(data.data.domainsAdded).toBe(1);
    expect(data.data.domainsNeedingPremium).toBe(1);
  });
});
