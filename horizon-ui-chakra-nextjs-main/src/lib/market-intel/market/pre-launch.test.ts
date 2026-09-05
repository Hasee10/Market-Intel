import { describe, it, expect, vi, beforeEach } from 'vitest';

// getPreLaunchInsight composes candidate search + the category price stats
// into the "should I stock this?" read. Everything below mocks at the same
// seams competitors.test.ts does - the Supabase client and the scope/fx
// lookups - so the assertions are about this module's own arithmetic and
// thresholds rather than about Postgres.

let candidateRows: any[] = [];
let singleRetailerPlatformIds: string[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (fn: string): Promise<{ data: any[]; error: null }> => {
      if (fn === 'market_single_retailer_platforms') {
        return { data: singleRetailerPlatformIds.map((platform_id) => ({ platform_id })), error: null };
      }
      return { data: candidateRows, error: null };
    },
  }),
}));

let activePlatformIds: string[] = ['p1'];

vi.mock('@/lib/market-intel/market/market-definition', () => ({
  getMarketScope: async () => ({
    categorySlugs: ['smartphones'],
    activePlatformIds,
    hasTaxonomy: true,
    definition: {},
    allSegments: [] as unknown[],
  }),
}));

vi.mock('@/lib/market-intel/fx', () => ({
  getLatestFxRates: async () => ({ PKR: 1 }),
  // Identity conversion: FX correctness is fx.test.ts's job, and a real
  // rate here would make every expected price below a second calculation.
  convertCurrency: (v: number) => v,
}));

let categoryPricing: any = null;
vi.mock('@/lib/market-intel/market/category-pricing', () => ({
  getCategoryPricing: async () => categoryPricing,
}));

import { getPreLaunchInsight } from './pre-launch';

function candidate(title: string, price: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `mp-${title}-${price}`,
    title,
    price: String(price),
    currency: 'PKR',
    url: 'https://example.com/x',
    image_url: 'https://example.com/x.jpg',
    category_slug: 'smartphones',
    platform_id: 'p1',
    platform_name: 'Daraz',
    rating: '4.5',
    rating_count: '10',
    sold_count: '20',
    seller_external_id: 'seller-a',
    ...overrides,
  };
}

beforeEach(() => {
  candidateRows = [];
  categoryPricing = null;
  singleRetailerPlatformIds = [];
  activePlatformIds = ['p1', 'p2', 'p3'];
});

describe('getPreLaunchInsight', () => {
  it('returns an empty, explicitly low-confidence read for a blank title rather than querying', async () => {
    const result = await getPreLaunchInsight('   ', 'mobiles', 'PKR');
    expect(result.matchCount).toBe(0);
    expect(result.hasEnoughData).toBe(false);
    expect(result.listings).toEqual([]);
  });

  it('reports the matched price band from the matching listings, not the whole category', async () => {
    candidateRows = [
      candidate('Samsung Galaxy A15 128GB', 40000),
      candidate('Samsung Galaxy A15 128GB Dual Sim', 50000),
      candidate('Samsung Galaxy A15 128GB Black', 60000),
    ];
    categoryPricing = { median: 999999, count: 5000 };

    const result = await getPreLaunchInsight('Samsung Galaxy A15 128GB', 'mobiles', 'PKR');

    expect(result.matchedPriceBand).toEqual({ min: 40000, median: 50000, max: 60000 });
    // The category figure is carried for context but must not be mistaken
    // for the band - they answer different questions.
    expect(result.categoryPricing?.median).toBe(999999);
  });

  it('counts distinct sellers and platforms, not listings', async () => {
    candidateRows = [
      candidate('Samsung Galaxy A15 128GB', 40000, { seller_external_id: 'a', platform_id: 'p1' }),
      candidate('Samsung Galaxy A15 128GB Dual', 41000, { seller_external_id: 'a', platform_id: 'p1' }),
      candidate('Samsung Galaxy A15 128GB Black', 42000, { seller_external_id: 'b', platform_id: 'p2' }),
    ];

    const result = await getPreLaunchInsight('Samsung Galaxy A15 128GB', 'mobiles', 'PKR');

    expect(result.matchCount).toBe(3);
    expect(result.competitorCount).toBe(2);
    expect(result.platformCount).toBe(2);
  });

  it('counts a single-retailer platform as one competitor even though its listings carry no seller id', async () => {
    singleRetailerPlatformIds = ['p1'];
    candidateRows = [
      candidate('Espresso Coffee Machine 15 Bar', 40000, { seller_external_id: null, platform_id: 'p1' }),
      candidate('Espresso Coffee Machine 15 Bar Steel', 41000, { seller_external_id: null, platform_id: 'p1' }),
      candidate('Espresso Coffee Machine 15 Bar Black', 42000, { seller_external_id: 'b', platform_id: 'p2' }),
    ];

    const result = await getPreLaunchInsight('Espresso Coffee Machine 15 Bar', 'appliances', 'PKR');

    expect(result.matchCount).toBe(3);
    // p1's two anonymous listings collapse onto one competitor (the
    // platform itself); p2's named seller is the other.
    expect(result.competitorCount).toBe(2);
    expect(result.platformCount).toBe(2);
  });

  it('does not fold two different single-retailer platforms onto the same competitor', async () => {
    singleRetailerPlatformIds = ['p1', 'p3'];
    candidateRows = [
      candidate('Espresso Coffee Machine 15 Bar', 40000, { seller_external_id: null, platform_id: 'p1' }),
      candidate('Espresso Coffee Machine 15 Bar Pro', 45000, { seller_external_id: null, platform_id: 'p3' }),
    ];

    const result = await getPreLaunchInsight('Espresso Coffee Machine 15 Bar', 'appliances', 'PKR');

    expect(result.competitorCount).toBe(2);
  });

  it('still excludes a listing with a genuine attribution gap on a real marketplace platform', async () => {
    singleRetailerPlatformIds = []; // p1 is a real marketplace here, not single-retailer
    candidateRows = [
      candidate('Espresso Coffee Machine 15 Bar', 40000, { seller_external_id: null, platform_id: 'p1' }),
      candidate('Espresso Coffee Machine 15 Bar Pro', 45000, { seller_external_id: 'seller-a', platform_id: 'p1' }),
    ];

    const result = await getPreLaunchInsight('Espresso Coffee Machine 15 Bar', 'appliances', 'PKR');

    expect(result.matchCount).toBe(2);
    expect(result.competitorCount).toBe(1);
  });

  it('flags a thin market instead of presenting a confident read over a handful of rows', async () => {
    candidateRows = [
      candidate('Samsung Galaxy A15 128GB', 40000),
      candidate('Samsung Galaxy A15 128GB Dual', 41000),
    ];

    const result = await getPreLaunchInsight('Samsung Galaxy A15 128GB', 'mobiles', 'PKR');

    expect(result.matchCount).toBe(2);
    expect(result.hasEnoughData).toBe(false);
  });

  it('treats five or more matches as enough to lean on', async () => {
    candidateRows = Array.from({ length: 5 }, (_, i) =>
      candidate(`Samsung Galaxy A15 128GB variant ${i}`, 40000 + i * 1000),
    );

    const result = await getPreLaunchInsight('Samsung Galaxy A15 128GB', 'mobiles', 'PKR');
    expect(result.hasEnoughData).toBe(true);
  });

  describe('price position', () => {
    beforeEach(() => {
      candidateRows = [
        candidate('Samsung Galaxy A15 128GB', 40000),
        candidate('Samsung Galaxy A15 128GB Dual', 50000),
        candidate('Samsung Galaxy A15 128GB Black', 60000),
      ];
    });

    it('is absent when the caller supplies no intended price', async () => {
      const result = await getPreLaunchInsight('Samsung Galaxy A15 128GB', 'mobiles', 'PKR');
      expect(result.pricePosition).toBeNull();
    });

    it('calls a price inside 5% of the median "at market" rather than over-reading the match', async () => {
      const result = await getPreLaunchInsight('Samsung Galaxy A15 128GB', 'mobiles', 'PKR', {
        intendedPrice: 51000, // +2% on a 50000 median
      });
      expect(result.pricePosition?.verdict).toBe('at market');
    });

    it('reports undercutting with the count of listings beaten', async () => {
      const result = await getPreLaunchInsight('Samsung Galaxy A15 128GB', 'mobiles', 'PKR', {
        intendedPrice: 45000,
      });
      expect(result.pricePosition?.verdict).toBe('below market');
      expect(result.pricePosition?.vsMatchedMedian).toBeCloseTo(-0.1, 5);
      // Beats the 50000 and 60000 listings, not the 40000 one.
      expect(result.pricePosition?.cheaperThanCount).toBe(2);
    });

    it('reports pricing above the market', async () => {
      const result = await getPreLaunchInsight('Samsung Galaxy A15 128GB', 'mobiles', 'PKR', {
        intendedPrice: 70000,
      });
      expect(result.pricePosition?.verdict).toBe('above market');
      expect(result.pricePosition?.cheaperThanCount).toBe(0);
    });
  });

  it('caps the returned sample while still counting every match', async () => {
    candidateRows = Array.from({ length: 20 }, (_, i) =>
      candidate(`Samsung Galaxy A15 128GB variant ${i}`, 40000 + i * 100),
    );

    const result = await getPreLaunchInsight('Samsung Galaxy A15 128GB', 'mobiles', 'PKR');

    expect(result.matchCount).toBe(20);
    expect(result.listings).toHaveLength(8);
  });

  it('drops listings whose titles are unrelated, so an empty market reads as empty', async () => {
    candidateRows = [candidate('Dog Chew Toy Bundle', 1800)];

    const result = await getPreLaunchInsight('Samsung Galaxy A15 128GB', 'mobiles', 'PKR');

    expect(result.matchCount).toBe(0);
    expect(result.matchedPriceBand).toBeNull();
  });
});
