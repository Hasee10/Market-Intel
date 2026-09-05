-- Adds image_url to market_top_similar_candidates so the Competitors drawer
-- (CompetitorsDrawer.tsx) can show a real listing photo instead of a bare
-- title link. market_products.image_url has existed since migration 001 and
-- most sources already populate it (daraz, shophive, priceoye, naheed,
-- telemart, the shopify/woo adapters) - this RPC just never selected it.
--
-- Only the single-title function (036), not market_top_similar_candidates_batch
-- (047): nothing that calls the batch path renders a per-listing image today,
-- so there is no consumer for the column there yet. Add it the same way if
-- that changes rather than carrying an unused column now.
--
-- create or replace cannot add a column to an existing table-returning
-- function's signature - Postgres errors "cannot change return type of
-- existing function" - so the old 4-argument/12-column signature has to be
-- dropped first, same lesson as migration 040's header.
--
-- Apply manually via the Supabase SQL Editor, after 036.

drop function if exists market_top_similar_candidates(text[], uuid[], text, integer);

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
  image_url text,
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
  select p.id, p.title, p.price, p.currency, p.url, p.image_url, p.category_slug,
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
