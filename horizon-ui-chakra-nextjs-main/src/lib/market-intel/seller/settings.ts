'server-only';

import { createClient } from '@/lib/supabase/server';
import type { Seller } from '@/lib/market-intel/seller/seller';

// Extracted from /api/profile's GET handler - same move as orders.ts, see
// its header comment. Throws on error, matching the established contract.
// PUT (settings mutation) stays in the route file - a real mutation from a
// client form.

export type PublicProfile = {
  isPublic: boolean;
  displayName: string;
  showPricePosition: boolean;
  showRating: boolean;
  showCategoryRank: boolean;
  // Separate consent scope from isPublic - that one only ever gated peer
  // (other-seller) visibility. This gates showing on the public marketing
  // homepage to anonymous visitors, see migration 024.
  website: string;
  showOnMarketingSite: boolean;
};

export type SellerProfile = {
  businessName: string;
  email: string;
  planTier: string;
  onboardedAt: string | null;
  reportingCurrency: string;
  country: string;
  publicProfile: PublicProfile;
};

export function mapPublicProfile(row: any): PublicProfile {
  return {
    isPublic: row?.is_public ?? false,
    displayName: row?.display_name ?? '',
    showPricePosition: row?.show_price_position ?? false,
    showRating: row?.show_rating ?? false,
    showCategoryRank: row?.show_category_rank ?? false,
    website: row?.website ?? '',
    showOnMarketingSite: row?.show_on_marketing_site ?? false,
  };
}

export async function getSellerProfile(seller: Seller): Promise<SellerProfile> {
  const supabase = await createClient();
  const { data: publicProfile, error } = await supabase
    .from('seller_public_profile')
    .select('is_public, display_name, show_price_position, show_rating, show_category_rank, website, show_on_marketing_site')
    .eq('seller_id', seller.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    businessName: seller.businessName,
    email: seller.email,
    planTier: seller.planTier,
    onboardedAt: seller.onboardedAt,
    reportingCurrency: seller.reportingCurrency,
    country: seller.country,
    publicProfile: mapPublicProfile(publicProfile),
  };
}
