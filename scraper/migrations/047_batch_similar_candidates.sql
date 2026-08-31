-- Batched form of market_top_similar_candidates (migration 036).
--
-- findTopProductMatches (product-matching.ts) and getCompetitorOverlapFromScope
-- (competitors.ts) both need "the best market candidates for this title" for up
-- to MAX_SELLER_PRODUCTS (20) seller products at once, and both did it by
-- issuing 20 separate market_top_similar_candidates calls via Promise.all.
-- A round-trip benchmark on 2026-08-31 measured that as 40 of the ~63 remaining
-- round-trips on the Market page and 40 of ~61 on Competitors - by a wide
-- margin the dominant remaining cost on both, once per-request deduplication
-- had removed the repeated ones (see memory.md's entry for that pass).
--
-- IMPORTANT - read before changing how this is called. The obvious use of this
-- function (pass all 20 titles in one call) is measurably WORSE than the 20
-- concurrent calls it replaces, and was very nearly shipped as an improvement.
-- Benchmarked locally on 60,000 rows across 12 categories (Postgres 18, 8
-- cores, pgbench, times are for resolving 20 titles):
--
--   20 single calls, 20 concurrent connections .... 590 ms   (the old design)
--   one 20-title call, 1 connection ............... 952 ms   <- 1.6x SLOWER
--   4 calls of 5 titles, 4 concurrent ............. 703 ms   (still worse!)
--
-- The reason: candidate search costs a flat ~50-60ms per title and batching
-- removes none of that work - unnest + LATERAL runs the same per-title index
-- scan, just sequentially inside one backend. Batching only ever trades
-- concurrency for fewer round-trips, and on its own that trade loses.
--
-- It only becomes a win once migration 048's composite index cuts the
-- per-title cost, and only when the batch is CHUNKED rather than sent whole:
--
--   20 single calls, 20 concurrent + idx 048 ...... 380 ms
--   4 calls of 5 titles, 4 concurrent + idx 048 ... 341 ms   <- shipped
--
-- So the shipped configuration is 4 concurrent calls of 5 titles each, giving
-- 590ms -> 341ms (1.7x) while holding 4 pooler connections per render instead
-- of 20. candidate-search.ts's CANDIDATE_BATCH_SIZE is that 5; do not raise it
-- towards 20 on the intuition that fewer round-trips must be faster - the
-- numbers above say otherwise. 047 and 048 are a pair; neither is worth
-- applying alone.
--
-- This deliberately returns EXACTLY what N separate calls return - same
-- filters, same per-title ORDER BY, same per-title LIMIT - because the Jaccard
-- accept/reject gate downstream (similarity.ts, MIN_CONFIDENCE /
-- MIN_COMPETITOR_CONFIDENCE) is unchanged and any difference here would
-- silently change which competitors sellers are shown. The LATERAL runs the
-- same index-backed trigram scan per title that 036 runs once; it is the same
-- database work in one round-trip, not less work.
--
-- 036's market_top_similar_candidates is intentionally left in place. It is
-- still the single-title path used by findCompetitorsForProduct (the
-- per-product Competitors drawer), which genuinely has one title and gains
-- nothing from unnest.
--
-- Apply manually via the Supabase SQL Editor, same convention as every prior
-- migration. Until it is applied, candidate-search.ts detects the missing
-- function and falls back to the per-title calls, so deploying the app before
-- running this degrades performance but does not break matching.

create or replace function market_top_similar_candidates_batch(
  p_category_slugs text[],
  p_platform_ids uuid[],
  p_query_titles text[],
  p_limit integer default 100
) returns table (
  -- 0-based so the caller can index a JS array directly. `with ordinality`
  -- is 1-based, hence the -1. Position in p_query_titles, not a product id:
  -- two seller products with identical titles still get their own row sets.
  query_index integer,
  id uuid,
  title text,
  price numeric,
  currency text,
  url text,
  category_slug text,
  platform_id uuid,
  platform_name text,
  rating numeric,
  rating_count integer,
  sold_count integer,
  seller_external_id text,
  similarity_score real
)
language sql
stable
security invoker
as $$
  select (q.ord - 1)::integer as query_index,
         c.id, c.title, c.price, c.currency, c.url, c.category_slug,
         c.platform_id, c.platform_name, c.rating, c.rating_count,
         c.sold_count, c.seller_external_id, c.similarity_score
  from unnest(p_query_titles) with ordinality as q(query_title, ord)
  cross join lateral (
    select p.id, p.title, p.price, p.currency, p.url, p.category_slug,
           p.platform_id, pl.name as platform_name, p.rating, p.rating_count,
           p.sold_count, p.seller_external_id,
           similarity(p.title, q.query_title) as similarity_score
    from market_products p
    join market_platforms pl on pl.id = p.platform_id
    where p.is_active
      and p.category_slug = any(p_category_slugs)
      and p.platform_id = any(p_platform_ids)
      -- The `%` operator is what lets the market_products_title_trgm_idx GIN
      -- index prune the table before ranking (see 036's header) - it must
      -- stay, a bare order-by-similarity would full-scan once per title,
      -- which at 20 titles is far worse than the 20 round-trips this
      -- replaces. A title that matches nothing simply contributes no rows,
      -- which is the same outcome the single-title function gives.
      and p.title % q.query_title
    order by similarity(p.title, q.query_title) desc
    limit p_limit
  ) c;
$$;
