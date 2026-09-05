import { describe, it, expect, vi, beforeEach } from 'vitest';

// autoAssignDomainsForCategories mirrors api/domains/route.ts's POST
// handler exactly (first domain free, anything beyond needs the
// multi_domain entitlement) - these tests exercise that gating
// deterministically, independent of entitlements.ts's DEMO_ALL_FEATURES_
// UNLOCKED flag (currently true, so hasFeature() always returns true in
// the real app right now - a real, temporary state worth knowing, not
// something these tests should be at the mercy of).

const existingDomainRows: { category_id: string }[] = [];
const upsertedRows: any[] = [];
let upsertError: { message: string } | null = null;
let hasFeatureResult = false;

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'seller_domains') {
        return {
          select: () => ({
            eq: async (): Promise<{ data: any[]; error: null }> => ({ data: existingDomainRows, error: null }),
          }),
          upsert: async (rows: any[]): Promise<{ error: { message: string } | null }> => {
            upsertedRows.push(...rows);
            return { error: upsertError };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock('@/lib/market-intel/core/entitlements', () => ({
  hasFeature: () => hasFeatureResult,
}));

import { autoAssignDomainsForCategories } from './seller';

beforeEach(() => {
  existingDomainRows.length = 0;
  upsertedRows.length = 0;
  upsertError = null;
  hasFeatureResult = false;
});

describe('autoAssignDomainsForCategories', () => {
  it('adds a single new category as the primary domain, free-tier allowed', async () => {
    const result = await autoAssignDomainsForCategories({ id: 'seller1', planTier: 'free' }, ['cat-mobiles']);

    expect(result.added).toEqual(['cat-mobiles']);
    expect(result.skippedNeedsPremium).toEqual([]);
    expect(upsertedRows).toEqual([{ seller_id: 'seller1', category_id: 'cat-mobiles', is_primary: true }]);
  });

  it('skips categories already tracked as a domain', async () => {
    existingDomainRows.push({ category_id: 'cat-mobiles' });

    const result = await autoAssignDomainsForCategories({ id: 'seller1', planTier: 'free' }, ['cat-mobiles']);

    expect(result.added).toEqual([]);
    expect(upsertedRows).toEqual([]);
  });

  it('free tier: first new domain succeeds, additional ones are gated behind Premium', async () => {
    hasFeatureResult = false;

    const result = await autoAssignDomainsForCategories({ id: 'seller1', planTier: 'free' }, [
      'cat-mobiles',
      'cat-home',
    ]);

    expect(result.added).toEqual(['cat-mobiles']);
    expect(result.skippedNeedsPremium).toEqual(['cat-home']);
    expect(upsertedRows).toEqual([{ seller_id: 'seller1', category_id: 'cat-mobiles', is_primary: true }]);
  });

  it('a seller who already has a domain and lacks multi_domain gets every new category skipped', async () => {
    existingDomainRows.push({ category_id: 'cat-existing' });
    hasFeatureResult = false;

    const result = await autoAssignDomainsForCategories({ id: 'seller1', planTier: 'free' }, ['cat-mobiles']);

    expect(result.added).toEqual([]);
    expect(result.skippedNeedsPremium).toEqual(['cat-mobiles']);
  });

  it('premium tier: adds every new category, only the very first is primary', async () => {
    hasFeatureResult = true;

    const result = await autoAssignDomainsForCategories({ id: 'seller1', planTier: 'premium' }, [
      'cat-mobiles',
      'cat-home',
    ]);

    expect(result.added).toEqual(['cat-mobiles', 'cat-home']);
    expect(result.skippedNeedsPremium).toEqual([]);
    expect(upsertedRows).toEqual([
      { seller_id: 'seller1', category_id: 'cat-mobiles', is_primary: true },
      { seller_id: 'seller1', category_id: 'cat-home', is_primary: false },
    ]);
  });

  it('deduplicates repeated category ids in the input', async () => {
    hasFeatureResult = true;

    await autoAssignDomainsForCategories({ id: 'seller1', planTier: 'premium' }, [
      'cat-mobiles',
      'cat-mobiles',
      'cat-mobiles',
    ]);

    expect(upsertedRows).toHaveLength(1);
  });

  it('returns an empty result without querying anything for an empty category list', async () => {
    const result = await autoAssignDomainsForCategories({ id: 'seller1', planTier: 'premium' }, []);

    expect(result).toEqual({ added: [], skippedNeedsPremium: [] });
    expect(upsertedRows).toEqual([]);
  });

  it('never throws, even if the upsert fails - a failure here must not break the caller', async () => {
    upsertError = { message: 'db exploded' };

    const result = await autoAssignDomainsForCategories({ id: 'seller1', planTier: 'free' }, ['cat-mobiles']);

    expect(result.added).toEqual([]);
  });
});
