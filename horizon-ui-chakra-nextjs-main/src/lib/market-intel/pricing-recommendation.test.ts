import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression cover for the defect this module shipped with: it selected every
// active product but priced them all against ONE category's band - whichever
// market happened to be on screen - so a seller with beds and phones had both
// judged against, say, the beauty P75. Every row then cited the same
// competitor figure and the advice was wrong for anything outside that one
// category.

let productRows: any[] = [];
const pricingBySlug: Record<string, any> = {};
let matches: any[] = [];
let scopeSlugs: string[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            not: () => ({
              not: async () => ({ data: productRows, error: null }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/market-intel/category-pricing', () => ({
  getCategoryPricing: async (slug: string) => pricingBySlug[slug] ?? null,
}));

vi.mock('@/lib/market-intel/market-definition', () => ({
  getMarketScope: async () => ({ categorySlugs: scopeSlugs, activePlatformIds: ['p1'] }),
}));

vi.mock('@/lib/market-intel/product-matching', () => ({
  findTopProductMatches: async () => matches,
}));

vi.mock('@/lib/market-intel/fx', () => ({
  getLatestFxRates: async () => ({ PKR: 1 }),
  convertCurrency: (amount: number) => amount,
}));

import { getPricingRecommendations } from './pricing-recommendation';

const band = (p25: number | null, p75: number | null) => ({
  categorySlug: 'x',
  count: 100,
  minPrice: 1,
  p25,
  median: 1000,
  p75,
  maxPrice: 99999,
});

function product(over: Partial<Record<string, any>> & { slug: string | null }) {
  const { slug, ...rest } = over;
  return {
    id: 'p1',
    title: 'Thing',
    cost_price: 1000,
    sell_price: 2000,
    currency: 'PKR',
    seller_categories: slug ? { slug } : null,
    ...rest,
  };
}

beforeEach(() => {
  productRows = [];
  matches = [];
  scopeSlugs = ['beauty'];
  for (const k of Object.keys(pricingBySlug)) delete pricingBySlug[k];
});

describe('getPricingRecommendations', () => {
  it('prices each product against its OWN category band, not the viewed market', async () => {
    // A phone priced in the tens of thousands alongside a beauty market whose
    // band tops out at 2821 - the exact shape of the reported bug.
    pricingBySlug['beauty'] = band(475, 2821);
    pricingBySlug['mobiles'] = band(40000, 90000);
    productRows = [
      product({ id: 'phone', title: 'Phone', slug: 'mobiles', cost_price: 55000, sell_price: 65000 }),
    ];

    const [rec] = await getPricingRecommendations('seller1', 'beauty', 'PKR');

    expect(rec.categorySlug).toBe('mobiles');
    expect(rec.competitorHigh).toBe(90000);
    // The beauty P75 must not appear anywhere in the reasoning.
    expect(rec.rationale).not.toContain('2821');
  });

  it('does not mark a product margin-constrained using an unrelated category band', async () => {
    pricingBySlug['beauty'] = band(475, 2821);
    pricingBySlug['mobiles'] = band(40000, 90000);
    productRows = [
      product({ id: 'phone', slug: 'mobiles', cost_price: 55000, sell_price: 65000 }),
    ];

    const [rec] = await getPricingRecommendations('seller1', 'beauty', 'PKR');

    // Against beauty's 2821 ceiling a 55k cost is "constrained"; against its
    // own band it plainly is not.
    expect(rec.marginConstrained).toBe(false);
  });

  it('skips a product whose category has no band rather than borrowing another', async () => {
    pricingBySlug['beauty'] = band(475, 2821);
    productRows = [product({ id: 'bed', slug: 'furniture', cost_price: 30000, sell_price: 48000 })];

    expect(await getPricingRecommendations('seller1', 'beauty', 'PKR')).toHaveLength(0);
  });

  it('skips a product with no category mapped at all', async () => {
    pricingBySlug['beauty'] = band(475, 2821);
    productRows = [product({ id: 'orphan', slug: null })];

    expect(await getPricingRecommendations('seller1', 'beauty', 'PKR')).toHaveLength(0);
  });

  it('ignores a product match from outside the scope the matches were computed in', async () => {
    // Matches come back scoped to the viewed market, so one attached to a
    // product in another category is a bed matched to a shampoo listing.
    pricingBySlug['mobiles'] = band(40000, 90000);
    scopeSlugs = ['beauty'];
    matches = [{ sellerProductId: 'phone', matchedPrice: 1200, confidence: 0.9 }];
    productRows = [product({ id: 'phone', slug: 'mobiles', cost_price: 55000, sell_price: 65000 })];

    const [rec] = await getPricingRecommendations('seller1', 'beauty', 'PKR');

    expect(rec.matchConfidence).toBeNull();
    expect(rec.competitorHigh).toBe(90000);
  });

  it('still uses a match when the product is inside the matched scope', async () => {
    pricingBySlug['beauty'] = band(475, 2821);
    scopeSlugs = ['beauty'];
    matches = [{ sellerProductId: 'serum', matchedPrice: 1600, confidence: 0.8 }];
    productRows = [product({ id: 'serum', slug: 'beauty', cost_price: 800, sell_price: 2999 })];

    const [rec] = await getPricingRecommendations('seller1', 'beauty', 'PKR');

    expect(rec.matchConfidence).toBe(0.8);
    expect(rec.competitorHigh).toBeCloseTo(1600 * 1.05, 5);
  });
});
