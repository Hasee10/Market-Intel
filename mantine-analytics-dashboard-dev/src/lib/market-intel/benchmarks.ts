'server-only';

import { createClient } from '@/lib/supabase/server';

export type DomainBenchmark = {
  metricName: string;
  p25: number | null;
  median: number | null;
  p75: number | null;
  sampleSize: number;
};

export type DomainPeer = {
  sellerId: string;
  displayName: string | null;
  showPricePosition: boolean;
  showRating: boolean;
  showCategoryRank: boolean;
};

// domain_benchmarks has no RLS restricting it beyond "any authenticated
// seller can read" (012_enable_seller_rls_policies.sql) - it's already an
// anonymized aggregate, computed by a backend job we haven't built yet, so
// an empty result here just means the job hasn't run for this category yet.
export async function getDomainBenchmarks(categoryId: string): Promise<DomainBenchmark[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('domain_benchmarks')
    .select('metric_name, p25, median, p75, sample_size')
    .eq('category_id', categoryId);

  if (error || !data) return [];

  return data.map((row) => ({
    metricName: row.metric_name,
    p25: row.p25,
    median: row.median,
    p75: row.p75,
    sampleSize: row.sample_size,
  }));
}

// seller_public_profiles_view only ever returns sellers who flipped
// is_public on in Settings -> Public profile, and only the fields listed
// there - see 012_enable_seller_rls_policies.sql for why this is safe to
// read broadly.
export async function getDomainPeers(
  categoryId: string,
  excludeSellerId: string,
): Promise<DomainPeer[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_public_profiles_view')
    .select('seller_id, display_name, show_price_position, show_rating, show_category_rank')
    .eq('category_id', categoryId)
    .neq('seller_id', excludeSellerId);

  if (error || !data) return [];

  return data.map((row) => ({
    sellerId: row.seller_id,
    displayName: row.display_name,
    showPricePosition: row.show_price_position,
    showRating: row.show_rating,
    showCategoryRank: row.show_category_rank,
  }));
}
