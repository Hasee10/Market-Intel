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
  /** Scraped listing image (market_products.image_url). Nullable. */
  imageUrl: string | null;
  categorySlug: string;
  platformId: string;
  platformName: string | null;
  rating: number | null;
  ratingCount: number | null;
  soldCount: number | null;
  sellerExternalId: string | null;
  /**
   * How many scraped listings this row stands for after
   * collapseDuplicateListings(). 1 for an untouched candidate; higher when
   * a retailer lists one product many times.
   */
  duplicateCount?: number;
};

type SimilarCandidateRow = {
  id: string;
  title: string;
  price: number | string | null;
  currency: string;
  url: string;
  image_url: string | null;
  category_slug: string;
  platform_id: string;
  platform_name: string | null;
  rating: number | string | null;
  rating_count: number | string | null;
  sold_count: number | string | null;
  seller_external_id: string | null;
};

/** Batch rows carry which input title they belong to; see migration 047. */
type BatchCandidateRow = SimilarCandidateRow & { query_index: number | string };

export const DEFAULT_CANDIDATE_LIMIT = 100;

/**
 * Collapses listings that are the same product listed repeatedly.
 *
 * Retailers routinely publish one product once per colour or size, at an
 * identical price, on one platform. Fifteen "3 Piece - Printed Lawn Suit"
 * rows at PKR 3,832 from one retailer are one competitor and one price,
 * but counted raw they are fifteen - which drags a median toward whichever
 * retailer happens to have the deepest variant catalogue, and tells a
 * seller they are up against a crowd that does not exist.
 *
 * Keyed on platform + normalised title + exact price, deliberately
 * conservative on that last part. Two listings of the same title at
 * different prices are genuinely different offers a buyer could choose
 * between, so they stay separate; only an exact price tie is unambiguous
 * duplication.
 *
 * Same posture as dedupeCatalogueRows in pricing-recommendation.ts: this is
 * a display-layer repair, the rows are still in the database, and the count
 * travels with the survivor instead of being quietly swallowed - a seller
 * who saw fifteen rows yesterday should be able to see where they went.
 */
export function collapseDuplicateListings(candidates: SimilarCandidate[]): SimilarCandidate[] {
  const byKey = new Map<string, SimilarCandidate>();

  for (const candidate of candidates) {
    const title = candidate.title.trim().toLowerCase().replace(/\s+/g, ' ');
    // Price is part of the key, so a null price cannot silently merge
    // rows whose prices are simply unknown.
    const price = candidate.price == null ? `no-price:${candidate.id}` : String(candidate.price);
    const key = `${candidate.platformId}::${title}::${price}`;

    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { ...candidate, duplicateCount: 1 });
      continue;
    }
    seen.duplicateCount = (seen.duplicateCount ?? 1) + 1;
    // Keep the best-evidenced copy: a variant carrying a rating and a sold
    // count is more useful to look at than an identically-priced one with
    // neither.
    const seenEvidence = (seen.ratingCount ?? 0) + (seen.soldCount ?? 0);
    const candidateEvidence = (candidate.ratingCount ?? 0) + (candidate.soldCount ?? 0);
    if (candidateEvidence > seenEvidence) {
      byKey.set(key, { ...candidate, duplicateCount: seen.duplicateCount });
    }
  }

  return [...byKey.values()];
}


function mapRow(row: SimilarCandidateRow): SimilarCandidate {
  return {
    id: row.id,
    title: row.title,
    price: row.price != null ? Number(row.price) : null,
    currency: row.currency,
    url: row.url,
    imageUrl: row.image_url ?? null,
    categorySlug: row.category_slug,
    platformId: row.platform_id,
    platformName: row.platform_name,
    rating: row.rating != null ? Number(row.rating) : null,
    ratingCount: row.rating_count != null ? Number(row.rating_count) : null,
    soldCount: row.sold_count != null ? Number(row.sold_count) : null,
    sellerExternalId: row.seller_external_id,
  };
}

// Migrations in this repo are applied by hand via the Supabase SQL Editor, so
// the app can legitimately be deployed before 047 has been run. These are the
// two ways that shows up: PostgREST can't find the function in its schema
// cache (PGRST202), or Postgres itself reports an undefined function (42883).
// Anything else - a real query error, a permissions problem - is NOT this, and
// must not be silently retried as if it were.
function isMissingFunctionError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883';
}

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

  return (data as SimilarCandidateRow[]).map(mapRow);
}

/**
 * Titles per call to market_top_similar_candidates_batch, with the remaining
 * chunks issued concurrently.
 *
 * Not a round number picked by feel - benchmarked, and the naive choice is
 * wrong. Candidate search costs a flat ~50-60ms per title and batching removes
 * none of that work: unnest + LATERAL runs the same per-title index scan, just
 * sequentially in one backend. So a bigger batch buys fewer round-trips at the
 * cost of the concurrency it gives up, and past a point that trade loses. On
 * 60k rows / 12 categories, resolving 20 titles (see 047's header for the full
 * table): 20 concurrent singles 380ms, 4 concurrent 5-title batches 341ms, one
 * 20-title batch 952ms. Raising this toward 20 makes pages slower, not faster.
 */
export const CANDIDATE_BATCH_SIZE = 5;

/**
 * The same candidate search for many titles, in chunked concurrent calls
 * (migrations 047 + 048).
 *
 * Returns one array per input title, index-aligned with `queryTitles` - so
 * `result[i]` is exactly what `findTopSimilarCandidates(..., queryTitles[i])`
 * would have returned, including an empty array when that title matches
 * nothing. Callers depend on that alignment to pair results back with their
 * seller product, so the length always equals `queryTitles.length`.
 *
 * Blank titles are never sent to the database (the single-title path skips
 * them too) but still occupy their slot in the result, which is why requests
 * are built from an explicit index map rather than a filtered array.
 */
export async function findTopSimilarCandidatesBatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categorySlugs: string[],
  platformIds: string[],
  queryTitles: string[],
  limit: number = DEFAULT_CANDIDATE_LIMIT,
): Promise<SimilarCandidate[][]> {
  const result: SimilarCandidate[][] = queryTitles.map((): SimilarCandidate[] => []);
  if (categorySlugs.length === 0 || platformIds.length === 0 || queryTitles.length === 0) return result;

  // Position in `queryTitles` for each title actually sent. Each chunk's
  // query_index counts only that chunk's titles, so it maps back through here
  // rather than being usable as a caller-facing index directly.
  const sent: { originalIndex: number; title: string }[] = [];
  queryTitles.forEach((title, originalIndex) => {
    if (title.trim()) sent.push({ originalIndex, title });
  });
  if (sent.length === 0) return result;

  const chunks: (typeof sent)[] = [];
  for (let i = 0; i < sent.length; i += CANDIDATE_BATCH_SIZE) {
    chunks.push(sent.slice(i, i + CANDIDATE_BATCH_SIZE));
  }

  let sawMissingFunction = false;

  await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase.rpc('market_top_similar_candidates_batch', {
        p_category_slugs: categorySlugs,
        p_platform_ids: platformIds,
        p_query_titles: chunk.map((s) => s.title),
        p_limit: limit,
      });

      if (error) {
        // Only a genuinely absent function is recoverable. A permissions or
        // query error must not be retried as N single calls - that would just
        // fail N more times, slowly.
        if (isMissingFunctionError(error)) sawMissingFunction = true;
        return;
      }
      if (!data) return;

      for (const row of data as BatchCandidateRow[]) {
        const entry = chunk[Number(row.query_index)];
        // Outside this chunk's range means the SQL function and this mapping
        // disagree; drop the row rather than write it to the wrong seller
        // product's slot.
        if (!entry) continue;
        result[entry.originalIndex].push(mapRow(row));
      }
    }),
  );

  if (sawMissingFunction) {
    // Migrations here are applied by hand, so the app can legitimately ship
    // before 047 runs. Fall back to the single-title path - matching still
    // works, just at the old cost. Loud on purpose: this is a deployment
    // ordering problem to fix, not a mode to sit in.
    console.warn(
      '[candidate-search] market_top_similar_candidates_batch is missing - apply scraper/migrations/047_batch_similar_candidates.sql and 048. Falling back to one call per title.',
    );
    const perTitle = await Promise.all(
      sent.map((s) => findTopSimilarCandidates(supabase, categorySlugs, platformIds, s.title, limit)),
    );
    const fallback: SimilarCandidate[][] = queryTitles.map((): SimilarCandidate[] => []);
    sent.forEach((s, i) => {
      fallback[s.originalIndex] = perTitle[i];
    });
    return fallback;
  }

  return result;
}
