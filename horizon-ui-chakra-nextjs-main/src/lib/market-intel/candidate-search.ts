'server-only';

import { createClient } from '@/lib/supabase/server';

// Shared by product-matching.ts and competitors.ts - both need "the market
// candidates most likely to match this one seller product's title," and
// both used to get it by fetching the whole category (capped, unordered)
// into JS. That silently truncated once a category's real row count grew
// past the cap (migrations/036_trigram_candidate_search.sql's own header has
// the live example). This calls the new market_top_similar_candidates RPC
// instead - pg_trgm does relevance ranking in SQL, index-backed, so the
// ~100 rows returned are the actual best textual matches for this title,
// not an arbitrary slice. Jaccard confidence scoring in similarity.ts is
// unchanged - this only changes which candidates get scored.
export type SimilarCandidate = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  url: string;
  categorySlug: string;
  platformId: string;
  platformName: string | null;
  rating: number | null;
  ratingCount: number | null;
  soldCount: number | null;
  sellerExternalId: string | null;
};

type SimilarCandidateRow = {
  id: string;
  title: string;
  price: number | string | null;
  currency: string;
  url: string;
  category_slug: string;
  platform_id: string;
  platform_name: string | null;
  rating: number | string | null;
  rating_count: number | string | null;
  sold_count: number | string | null;
  seller_external_id: string | null;
};

export const DEFAULT_CANDIDATE_LIMIT = 100;

export async function findTopSimilarCandidates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categorySlugs: string[],
  platformIds: string[],
  queryTitle: string,
  limit: number = DEFAULT_CANDIDATE_LIMIT,
): Promise<SimilarCandidate[]> {
  if (categorySlugs.length === 0 || platformIds.length === 0 || !queryTitle.trim()) return [];

  const { data, error } = await supabase.rpc('market_top_similar_candidates', {
    p_category_slugs: categorySlugs,
    p_platform_ids: platformIds,
    p_query_title: queryTitle,
    p_limit: limit,
  });

  if (error || !data) return [];

  return (data as SimilarCandidateRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    price: row.price != null ? Number(row.price) : null,
    currency: row.currency,
    url: row.url,
    categorySlug: row.category_slug,
    platformId: row.platform_id,
    platformName: row.platform_name,
    rating: row.rating != null ? Number(row.rating) : null,
    ratingCount: row.rating_count != null ? Number(row.rating_count) : null,
    soldCount: row.sold_count != null ? Number(row.sold_count) : null,
    sellerExternalId: row.seller_external_id,
  }));
}
