'server-only';

import { createClient } from '@/lib/supabase/server';

export type OnboardingStatus = {
  hasDomain: boolean;
  hasProduct: boolean;
  hasOrder: boolean;
  hasWatchlistItem: boolean;
  hasPublicProfile: boolean;
};

// Backs the "Getting Started" checklist on Overview - treats a brand-new
// seller's empty dashboard as the primary onboarding surface (checklist
// pattern) rather than just showing $0.00 everywhere with no next step.
// Every check is a bounded existence query (limit 1), not a count, since
// this only needs to answer "has at least one" - cheap regardless of how
// much data a seller eventually has.
export async function getOnboardingStatus(sellerId: string): Promise<OnboardingStatus> {
  const supabase = await createClient();

  const [domainRes, productRes, orderRes, watchlistRes, profileRes] = await Promise.all([
    supabase.from('seller_domains').select('id').eq('seller_id', sellerId).limit(1),
    supabase.from('seller_products').select('id').eq('seller_id', sellerId).limit(1),
    supabase.from('seller_orders').select('id').eq('seller_id', sellerId).limit(1),
    supabase
      .from('seller_watchlist_items')
      .select('id, seller_watchlists!inner(seller_id)')
      .eq('seller_watchlists.seller_id', sellerId)
      .limit(1),
    supabase.from('seller_public_profile').select('seller_id').eq('seller_id', sellerId).eq('is_public', true).limit(1),
  ]);

  return {
    hasDomain: (domainRes.data?.length ?? 0) > 0,
    hasProduct: (productRes.data?.length ?? 0) > 0,
    hasOrder: (orderRes.data?.length ?? 0) > 0,
    hasWatchlistItem: (watchlistRes.data?.length ?? 0) > 0,
    hasPublicProfile: (profileRes.data?.length ?? 0) > 0,
  };
}
