import { describe, it, expect, vi, beforeEach } from 'vitest';

// resolveSelectedDomain backs the header's domain switcher on every
// domain-scoped page. Its own file rather than an addition to
// seller.test.ts because it needs a different Supabase mock shape: it
// drives both getPrimaryDomain (.eq().eq().maybeSingle()) and
// listSellerDomains (.eq().order()) off the same table.
//
// The case that matters most for correctness rather than UX is the
// foreign-slug one: resolution goes through the seller's own tracked
// domains, so hand-editing ?domain= to a category they do not track must
// fall back to their primary rather than rendering another market.

let primaryRow: any = {
  category_id: 'cat-mobiles',
  seller_categories: { slug: 'mobiles-and-electronics', name: 'Mobiles & Electronics' },
};

let domainRows: any[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table !== 'seller_domains') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            // getPrimaryDomain's second .eq('is_primary', true)
            eq: () => ({
              maybeSingle: async (): Promise<{ data: any; error: null }> => ({ data: primaryRow, error: null }),
            }),
            // listSellerDomains' .order('is_primary', ...)
            order: async (): Promise<{ data: any[]; error: null }> => ({ data: domainRows, error: null }),
          }),
        }),
      };
    },
  }),
}));

vi.mock('@/lib/market-intel/core/entitlements', () => ({ hasFeature: () => true }));

import { resolveSelectedDomain } from './seller';

beforeEach(() => {
  primaryRow = {
    category_id: 'cat-mobiles',
    seller_categories: { slug: 'mobiles-and-electronics', name: 'Mobiles & Electronics' },
  };
  domainRows = [
    {
      id: 'd1',
      category_id: 'cat-mobiles',
      is_primary: true,
      seller_categories: { slug: 'mobiles-and-electronics', name: 'Mobiles & Electronics' },
    },
    {
      id: 'd2',
      category_id: 'cat-fashion',
      is_primary: false,
      seller_categories: { slug: 'fashion-and-apparel', name: 'Fashion & Apparel' },
    },
  ];
});

describe('resolveSelectedDomain', () => {
  it('falls back to the primary domain when no slug is given', async () => {
    const result = await resolveSelectedDomain('seller1', undefined);

    expect(result).toEqual({
      categoryId: 'cat-mobiles',
      categorySlug: 'mobiles-and-electronics',
      categoryName: 'Mobiles & Electronics',
    });
  });

  it('treats an empty-string slug as absent rather than as an unmatched domain', async () => {
    const result = await resolveSelectedDomain('seller1', '');

    expect(result?.categorySlug).toBe('mobiles-and-electronics');
  });

  it('returns the requested domain when the seller tracks it', async () => {
    const result = await resolveSelectedDomain('seller1', 'fashion-and-apparel');

    expect(result).toEqual({
      categoryId: 'cat-fashion',
      categorySlug: 'fashion-and-apparel',
      categoryName: 'Fashion & Apparel',
    });
  });

  // URL tampering / a bookmark to a domain since removed. Both land here.
  it('falls back to primary for a slug the seller does not track', async () => {
    const result = await resolveSelectedDomain('seller1', 'home-and-kitchen');

    expect(result?.categorySlug).toBe('mobiles-and-electronics');
  });

  it('falls back to primary for a domain the seller has since removed', async () => {
    domainRows = domainRows.filter((row) => row.category_id !== 'cat-fashion');

    const result = await resolveSelectedDomain('seller1', 'fashion-and-apparel');

    expect(result?.categorySlug).toBe('mobiles-and-electronics');
  });

  it('returns null when the seller has no primary domain and no slug is given', async () => {
    primaryRow = null;

    const result = await resolveSelectedDomain('seller1', undefined);

    expect(result).toBeNull();
  });

  it('still resolves a tracked slug for a seller with no primary flagged', async () => {
    primaryRow = null;

    const result = await resolveSelectedDomain('seller1', 'fashion-and-apparel');

    expect(result?.categorySlug).toBe('fashion-and-apparel');
  });
});
