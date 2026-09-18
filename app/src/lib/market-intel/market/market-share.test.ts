import { describe, it, expect, vi, beforeEach } from 'vitest';

// The share arithmetic, where the seller lands among named competitors,
// and that the free tier gets the number but not the names.

let marketCount = 0;
let sellerCount = 0;
let scorecards: { name: string; platformName: string; skuCount: number }[] = [];
let identifiedSkuCount = 0;

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => ({
      select: () => {
        const b: any = {
          eq: () => b,
          in: () => b,
          then: (resolve: (v: unknown) => void) =>
            resolve({ count: table === 'market_products' ? marketCount : sellerCount, error: null }),
        };
        return b;
      },
    }),
  }),
}));

vi.mock('@/lib/market-intel/market/market-definition', () => ({
  getMarketScope: async () => ({ categorySlugs: ['beauty'], activePlatformIds: ['p1', 'p2'] }),
}));

vi.mock('@/lib/market-intel/market/competitors', () => ({
  getCompetitorLandscape: async () => ({ scorecards, identifiedSkuCount }),
}));

import { getMarketShare } from './market-share';

beforeEach(() => {
  marketCount = 0;
  sellerCount = 0;
  scorecards = [];
  identifiedSkuCount = 0;
});

describe('getMarketShare', () => {
  it("adds the seller's own catalogue to the denominator", async () => {
    marketCount = 5726;
    sellerCount = 87;

    const s = await getMarketShare('s1', 'cat1', 'beauty', 'Beauty', 'PKR', false);

    // 87 / (5726 + 87) = 1.497% → 1.5
    expect(s?.listingShare).toBe(1.5);
    expect(s?.marketListings).toBe(5726);
    expect(s?.sellerListings).toBe(87);
    expect(s?.platformsInScope).toBe(2);
  });

  it('places the seller among named competitors by catalogue size, paid tier only', async () => {
    marketCount = 1000;
    sellerCount = 120;
    identifiedSkuCount = 600;
    scorecards = [
      { name: 'Big', platformName: 'Daraz', skuCount: 300 },
      { name: 'Mid', platformName: 'Daraz', skuCount: 150 },
      { name: 'Small', platformName: 'Daraz', skuCount: 40 },
    ];

    const paid = await getMarketShare('s1', 'cat1', 'beauty', 'Beauty', 'PKR', true);
    expect(paid?.sellerRankAmongNamed).toBe(3); // behind Big (300) and Mid (150), ahead of Small (40)
    expect(paid?.topNamed.map((c) => c.name)).toEqual(['Big', 'Mid', 'Small']);
    // Big's share: 300 / (600 identified + 120 seller) = 41.7
    expect(paid?.topNamed[0].share).toBe(41.7);

    const free = await getMarketShare('s1', 'cat1', 'beauty', 'Beauty', 'PKR', false);
    expect(free?.sellerRankAmongNamed).toBeNull();
    expect(free?.topNamed).toEqual([]);
    expect(free?.namedCompetitorCount).toBe(3);
    expect(free?.caveats.some((c) => c.includes('3 named competitors') && c.includes('Paid plan'))).toBe(true);
  });

  it('returns zeros rather than NaN for an empty market', async () => {
    const s = await getMarketShare('s1', 'cat1', 'beauty', 'Beauty', 'PKR', true);
    expect(s?.listingShare).toBe(0);
    expect(s?.sellerRankAmongNamed).toBeNull();
  });

  it('states the denominator in its own caveat', async () => {
    marketCount = 5726;
    sellerCount = 87;
    const s = await getMarketShare('s1', 'cat1', 'beauty', 'Beauty & Personal Care', 'PKR', false);
    expect(s?.caveats[0]).toContain('87 active products');
    expect(s?.caveats[0]).toContain('5,726 active listings');
    expect(s?.caveats[0]).toContain('2 platforms');
  });
});
