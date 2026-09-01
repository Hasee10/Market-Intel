-- Finds a real product photo for a seller's own product by matching its
-- title against the scraped catalogue.
--
-- Why this exists: seller_products.image_url (049) is optional and most
-- sellers will never fill it in, but market_products already holds a real
-- image for tens of thousands of listings scraped from 56 Pakistani
-- marketplaces. Matching "Samsung Galaxy A15" in a seller's catalogue to the
-- same phone on Daraz gives an accurate photo for free, instead of a generic
-- icon or a stock image of something the seller does not actually sell.
--
-- Uses the pg_trgm index added in 036, so this is an index scan rather than
-- a full table scan. `%` prunes on the session similarity threshold first,
-- then only the survivors are ranked.
--
-- One call handles the whole page: the app passes every title needing an
-- image and gets back one row per title, rather than issuing N queries.
--
-- The seller's own image_url always wins - this is only consulted when that
-- column is null, so setting an image explicitly is never overridden.
--
-- Apply manually via the Supabase SQL Editor, same convention as 001-049.
-- Requires 036 (pg_trgm + the GIN index on market_products.title).

create or replace function market_images_for_titles(
  p_titles text[],
  p_min_similarity real default 0.35
) returns table (
  query_index integer,
  image_url text,
  matched_title text,
  similarity_score real
)
language sql
stable
security invoker
as $$
  select
    t.idx - 1 as query_index,
    m.image_url,
    m.title as matched_title,
    m.score as similarity_score
  from unnest(p_titles) with ordinality as t(title, idx)
  cross join lateral (
    select p.image_url, p.title, similarity(p.title, t.title) as score
    from market_products p
    where p.is_active
      and p.image_url is not null
      and p.title % t.title
    order by similarity(p.title, t.title) desc
    limit 1
  ) m
  -- A weak match is worse than no image: it would show a photo of a
  -- different product with the seller's own name beside it. Above this the
  -- match is close enough to be the same item or a near-identical variant.
  where m.score >= p_min_similarity;
$$;
