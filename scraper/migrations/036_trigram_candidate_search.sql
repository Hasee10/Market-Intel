-- Fixes a real, confirmed data-completeness bug in competitor matching: the
-- candidate queries in product-matching.ts (findCompetitorsForProduct,
-- findTopProductMatches) and competitors.ts (getCompetitorOverlap) had no
-- ORDER BY and a hard row cap (3000, or just 1500 on the Competitors page).
-- Once a category's real active-row count exceeds that cap - fashion-and-
-- apparel is now an estimated 9,000-12,000+ rows across 13 sources, after
-- today's scraper expansion - Postgres returns an arbitrary, unordered slice
-- that may not include the seller's actual best match at all. Live example:
-- "Zellbury Plain Shalwar Kameez" showed "No comparable listings found"
-- despite ~3,665 real Zellbury products existing, because the unordered
-- sample never happened to include one.
--
-- Fix: push candidate SELECTION into SQL via pg_trgm trigram similarity,
-- ranked and index-backed, instead of an app-side hope that an unordered
-- LIMIT happens to include the right rows. This does NOT replace the
-- existing Jaccard title-confidence scoring in similarity.ts - that stays
-- exactly as-is as the actual accept/reject gate (MIN_CONFIDENCE /
-- MIN_COMPETITOR_CONFIDENCE). pg_trgm only decides which ~100 candidates out
-- of thousands are even considered before Jaccard scores them.
--
-- Apply manually via the Supabase SQL Editor, same convention as every prior
-- migration.

create extension if not exists pg_trgm;

-- Partial index (active rows only, matching every other index in this
-- schema) - without it, `market_top_similar_candidates` below would still
-- have to scan the whole table before ranking, defeating the point at
-- 12,000+ rows in a single category.
create index if not exists market_products_title_trgm_idx
  on market_products using gin (title gin_trgm_ops)
  where is_active;

-- Same style/conventions as market_scope_price_stats (021) and
-- market_competitor_scorecards (022): language sql, stable, security
-- invoker, p_category_slugs/p_platform_ids as arrays.
--
-- The `%` operator (pg_trgm's similarity-threshold operator, using the
-- session's pg_trgm.similarity_threshold, default 0.3) is what lets the GIN
-- index actually prune most of the table before ranking - a plain
-- `order by similarity(...) desc limit p_limit` without it would still be a
-- full scan.
create or replace function market_top_similar_candidates(
  p_category_slugs text[],
  p_platform_ids uuid[],
  p_query_title text,
  p_limit integer default 100
) returns table (
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
  select p.id, p.title, p.price, p.currency, p.url, p.category_slug,
         p.platform_id, pl.name as platform_name, p.rating, p.rating_count,
         p.sold_count, p.seller_external_id,
         similarity(p.title, p_query_title) as similarity_score
  from market_products p
  join market_platforms pl on pl.id = p.platform_id
  where p.is_active
    and p.category_slug = any(p_category_slugs)
    and p.platform_id = any(p_platform_ids)
    and p.title % p_query_title
  order by similarity_score desc
  limit p_limit;
$$;
