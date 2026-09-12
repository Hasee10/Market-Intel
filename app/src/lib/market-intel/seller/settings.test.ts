import { describe, it, expect, beforeEach, vi } from 'vitest';

type Resp = { data: any; error: { message: string } | null };
let response: Resp = { data: null, error: null };

function fakeBuilder() {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(response),
  };
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: () => fakeBuilder() }),
}));

import { getSellerProfile } from './settings';
import type { Seller } from './seller';

const seller: Seller = {
  id: 'seller1',
  userId: 'user1',
  businessName: 'Acme',
  email: 'a@acme.com',
  planTier: 'premium',
  onboardedAt: '2026-01-01',
  reportingCurrency: 'PKR',
  country: 'PK',
};

beforeEach(() => {
  response = { data: null, error: null };
});

describe('getSellerProfile', () => {
  it('throws the underlying Supabase error message rather than swallowing it', async () => {
    response = { data: null, error: { message: 'connection refused' } };
    await expect(getSellerProfile(seller)).rejects.toThrow('connection refused');
  });

  it('defaults public profile fields when no row exists yet', async () => {
    response = { data: null, error: null };
    const profile = await getSellerProfile(seller);
    expect(profile.publicProfile).toEqual({
      isPublic: false,
      displayName: '',
      showPricePosition: false,
      showRating: false,
      showCategoryRank: false,
      website: '',
      showOnMarketingSite: false,
    });
  });

  it('combines seller fields with the mapped public profile row', async () => {
    response = {
      data: {
        is_public: true,
        display_name: 'Acme Store',
        show_price_position: true,
        show_rating: false,
        show_category_rank: true,
        website: 'acme.pk',
        show_on_marketing_site: true,
      },
      error: null,
    };
    const profile = await getSellerProfile(seller);
    expect(profile.businessName).toBe('Acme');
    expect(profile.publicProfile.displayName).toBe('Acme Store');
    expect(profile.publicProfile.isPublic).toBe(true);
  });
});
