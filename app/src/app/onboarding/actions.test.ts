import { describe, it, expect, vi, beforeEach } from 'vitest';

// completeOnboarding orchestrates three things that must happen in order
// and exactly once: clear stale seller_domains, delegate the actual
// domain-add logic to autoAssignDomainsForCategories (already exhaustively
// tested in seller.test.ts - not re-tested here), then update
// country/onboarded_at and redirect. The risk this file guards against:
// redirect() firing before the domain loop completes, or firing more than
// once for a multi-domain submission.

const deletedFor: string[] = [];
const sellerUpdates: any[] = [];
let sellerRow: { id: string; plan_tier: string } | null = { id: 'seller1', plan_tier: 'free' };
let assignResult = { added: ['cat-a'], skippedNeedsPremium: [] as string[] };
const assignCalls: { seller: any; categoryIds: string[] }[] = [];
const redirectCalls: string[] = [];

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirectCalls.push(path);
    // Real redirect() throws to unwind the call stack - mirrored here so a
    // test can assert nothing after redirect() ran (e.g. a second call).
    throw new Error(`REDIRECT:${path}`);
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user1' } } }) },
    from: (table: string) => {
      if (table === 'sellers') {
        return {
          select: () => ({
            eq: () => ({
              single: async (): Promise<{ data: typeof sellerRow; error: { message: string } | null }> => ({
                data: sellerRow,
                error: sellerRow ? null : { message: 'not found' },
              }),
            }),
          }),
          update: (values: any) => ({
            eq: async (): Promise<{ error: { message: string } | null }> => {
              sellerUpdates.push(values);
              return { error: null };
            },
          }),
        };
      }
      if (table === 'seller_domains') {
        return {
          delete: () => ({
            eq: async (_col: string, sellerId: string): Promise<{ error: { message: string } | null }> => {
              deletedFor.push(sellerId);
              return { error: null };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock('@/lib/market-intel/seller/seller', () => ({
  autoAssignDomainsForCategories: async (seller: any, categoryIds: string[]) => {
    assignCalls.push({ seller, categoryIds });
    return assignResult;
  },
}));

import { completeOnboarding } from './actions';

beforeEach(() => {
  deletedFor.length = 0;
  sellerUpdates.length = 0;
  assignCalls.length = 0;
  redirectCalls.length = 0;
  sellerRow = { id: 'seller1', plan_tier: 'free' };
  assignResult = { added: ['cat-a'], skippedNeedsPremium: [] };
});

describe('completeOnboarding', () => {
  it('clears stale domains, assigns every picked category in one call, then redirects exactly once', async () => {
    assignResult = { added: ['cat-a', 'cat-b'], skippedNeedsPremium: [] };

    await expect(completeOnboarding(['cat-a', 'cat-b'], 'PK')).rejects.toThrow('REDIRECT:/dashboard/market');

    expect(deletedFor).toEqual(['seller1']);
    // One call with both ids, not a loop of single-id calls - the free-
    // first/premium-rest rule inside autoAssignDomainsForCategories needs
    // to see the whole batch to decide which id is primary.
    expect(assignCalls).toEqual([{ seller: { id: 'seller1', planTier: 'free' }, categoryIds: ['cat-a', 'cat-b'] }]);
    expect(redirectCalls).toEqual(['/dashboard/market']);
    expect(sellerUpdates).toHaveLength(1);
    expect(sellerUpdates[0]).toMatchObject({ country: 'PK' });
  });

  it('deduplicates and caps at 3 categories before assigning', async () => {
    assignResult = { added: ['cat-a', 'cat-b', 'cat-c'], skippedNeedsPremium: [] };

    await expect(
      completeOnboarding(['cat-a', 'cat-a', 'cat-b', 'cat-c', 'cat-d'], 'PK'),
    ).rejects.toThrow('REDIRECT:/dashboard/market');

    expect(assignCalls[0].categoryIds).toEqual(['cat-a', 'cat-b', 'cat-c']);
  });

  it('returns an error instead of redirecting when no category was actually added', async () => {
    assignResult = { added: [], skippedNeedsPremium: ['cat-a'] };

    const result = await completeOnboarding(['cat-a'], 'PK');

    expect(result).toEqual({ error: 'Could not save your domain. Please try again.' });
    expect(redirectCalls).toEqual([]);
  });

  it('returns an error without touching seller_domains when no category is picked', async () => {
    const result = await completeOnboarding([], 'PK');

    expect(result).toEqual({ error: 'Pick at least one category to continue' });
    expect(deletedFor).toEqual([]);
    expect(assignCalls).toEqual([]);
  });

  it('an invalid country code is silently dropped, not an error', async () => {
    await expect(completeOnboarding(['cat-a'], 'ZZ')).rejects.toThrow('REDIRECT:/dashboard/market');

    expect(sellerUpdates[0]).not.toHaveProperty('country');
    expect(sellerUpdates[0]).toHaveProperty('onboarded_at');
  });
});
