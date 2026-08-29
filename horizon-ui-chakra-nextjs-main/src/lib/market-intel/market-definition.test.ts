import { describe, it, expect, vi, beforeEach } from 'vitest';

// getMarketScopeForAllDomains unions every tracked domain's own
// getMarketScope() result (categorySlugs, activePlatformIds) into one scope
// for the Competitors page's "All My Products" tab - see the function's own
// comment for why a unioned array is a valid input to the RPCs a
// single-category scope already uses. Mocked at the Supabase boundary
// (not by mocking getMarketScope itself, which lives in this same module)
// so the real union/merge logic runs end to end.

let domainSlugs: string[] = [];
const taxonomyByCategory: Record<string, any[]> = {};

vi.mock('@/lib/market-intel/seller', () => ({
  getCurrentSeller: async (): Promise<null> => null,
  listSellerDomainSlugs: async (): Promise<string[]> => domainSlugs,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'market_category_map') {
        return {
          select: () => ({
            eq: async (_col: string, categorySlug: string): Promise<{ data: any[]; error: null }> => ({
              data: taxonomyByCategory[categorySlug] ?? [],
              error: null,
            }),
          }),
        };
      }
      if (table === 'seller_market_definitions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async (): Promise<{ data: null; error: null }> => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

function node(platformId: string, platformName: string, categorySlug: string, segmentSlug: string) {
  return {
    platform_id: platformId,
    category_slug: categorySlug,
    segment_slug: segmentSlug,
    segment_label: segmentSlug,
    market_platforms: { name: platformName },
  };
}

import { getMarketScopeForAllDomains } from './market-definition';

beforeEach(() => {
  domainSlugs = [];
  for (const key of Object.keys(taxonomyByCategory)) delete taxonomyByCategory[key];
});

describe('getMarketScopeForAllDomains', () => {
  it('returns an empty scope for a seller with no tracked domains', async () => {
    domainSlugs = [];
    const scope = await getMarketScopeForAllDomains('seller1');
    expect(scope.categorySlugs).toEqual([]);
    expect(scope.activePlatformIds).toEqual([]);
    expect(scope.hasTaxonomy).toBe(false);
  });

  it('unions category slugs and platform ids across multiple domains', async () => {
    domainSlugs = ['mobiles-and-electronics', 'fashion-and-apparel'];
    taxonomyByCategory['mobiles-and-electronics'] = [node('p1', 'Daraz', 'smartphones', 'phones')];
    taxonomyByCategory['fashion-and-apparel'] = [node('p2', 'Zellbury', 'women', 'womenswear')];

    const scope = await getMarketScopeForAllDomains('seller1');

    expect(new Set(scope.categorySlugs)).toEqual(new Set(['smartphones', 'women']));
    expect(new Set(scope.activePlatformIds)).toEqual(new Set(['p1', 'p2']));
    expect(scope.hasTaxonomy).toBe(true);
  });

  it('deduplicates a platform that serves multiple tracked domains', async () => {
    domainSlugs = ['mobiles-and-electronics', 'home-and-kitchen'];
    taxonomyByCategory['mobiles-and-electronics'] = [node('p1', 'Daraz', 'smartphones', 'phones')];
    taxonomyByCategory['home-and-kitchen'] = [node('p1', 'Daraz', 'home-decor', 'home')];

    const scope = await getMarketScopeForAllDomains('seller1');

    expect(scope.activePlatformIds).toEqual(['p1']);
    expect(scope.categorySlugs.sort()).toEqual(['home-decor', 'smartphones']);
  });

  it('uses the plain default definition (no price band/brands/cities) for the union', async () => {
    domainSlugs = ['mobiles-and-electronics'];
    taxonomyByCategory['mobiles-and-electronics'] = [node('p1', 'Daraz', 'smartphones', 'phones')];

    const scope = await getMarketScopeForAllDomains('seller1');

    expect(scope.definition.priceMin).toBeNull();
    expect(scope.definition.priceMax).toBeNull();
    expect(scope.definition.brands).toEqual([]);
    expect(scope.definition.cities).toEqual([]);
  });

  it('matchesCategory/matchesRow reflect the unioned scope', async () => {
    domainSlugs = ['mobiles-and-electronics', 'fashion-and-apparel'];
    taxonomyByCategory['mobiles-and-electronics'] = [node('p1', 'Daraz', 'smartphones', 'phones')];
    taxonomyByCategory['fashion-and-apparel'] = [node('p2', 'Zellbury', 'women', 'womenswear')];

    const scope = await getMarketScopeForAllDomains('seller1');

    expect(scope.matchesCategory('smartphones')).toBe(true);
    expect(scope.matchesCategory('women')).toBe(true);
    expect(scope.matchesCategory('unrelated-slug')).toBe(false);
    expect(scope.matchesRow({ categorySlug: 'smartphones', platformId: 'p1' })).toBe(true);
    // Category and platform membership are checked independently, matching
    // the real RPC queries (two separate .in() filters, not a tied pairing)
    // - so a slug/platform pair that never co-occurs in real data (Zellbury
    // never actually has a smartphones row) still passes this check. Not a
    // gap introduced by the union: the original single-domain scope has the
    // same independent-filter semantics, by design (see its own comment).
    expect(scope.matchesRow({ categorySlug: 'smartphones', platformId: 'p2' })).toBe(true);
    expect(scope.matchesRow({ categorySlug: 'unrelated-slug', platformId: 'p1' })).toBe(false);
    expect(scope.matchesRow({ categorySlug: 'smartphones', platformId: 'unrelated-platform' })).toBe(false);
  });
});
