-- Fixes two real defects found in a code audit of the competitors page
-- (2026-08-29), both in market_competitor_scorecards (022):
--
-- 1. The function never accepted price band / brand / city filters, while
--    the market-median it gets divided against (market_scope_price_stats,
--    021) does. A seller who sets a price band on their Market Definition
--    page therefore got a price_index computed as
--      (this competitor's median over their WHOLE catalog, unfiltered)
--      / (the market median, correctly filtered to the band)
--    - a ratio of two differently-scoped populations, not "how this
--    competitor prices against your market". Fixed by applying the same
--    brand/price-band filter block market_scope_price_stats already uses
--    (021's `filtered` CTE), lifted here unchanged in spirit. City is
--    accepted for signature symmetry with the other scope functions but is
--    a deliberate no-op: this function only ever reads market_products,
--    which carries no city column (only OLX-style classifieds do, and
--    those are excluded here on purpose - see 022's header comment), so a
--    city filter has nothing to exclude and must not silently zero out
--    every competitor the way an unconditional predicate would.
--
-- 2. sku_count / identifiedSkuCount was summed client-side over only the
--    p_limit=25 returned rows, then used as the assortment-share
--    denominator - so with more than 25 identified sellers in scope (Daraz
--    alone has 58 in `laptops` per mind.md), the "Listings with a named
--    seller" stat undercounted and every assortmentShare was inflated.
--    Fixed by computing the true total over the full grouped set (before
--    the top-N limit) and returning it on every row as
--    total_identified_sku_count - one extra bigint column, no second round
--    trip, and TypeScript now reads this instead of summing the page.
--
-- Return type changes (new column), so `create or replace` cannot be used
-- as-is - the old 6-argument, 17-column-return signature must be dropped
-- first, same lesson as migration 026's overload issue (see mind.md).
--
-- Apply manually via the Supabase SQL Editor, after 022. Depends on nothing
-- new - market_convert_currency (021) and market_platforms are already live
-- wherever 022 is.

drop function if exists market_competitor_scorecards(text[], uuid[], text, jsonb, integer, integer);

create or replace function market_competitor_scorecards(
  p_category_slugs text[],
  p_platform_ids uuid[],
  p_target_currency text,
  p_rates jsonb,
  p_lookback_days integer default 30,
  p_limit integer default 25,
  p_band_currency text default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_brands text[] default '{}',
  p_cities text[] default '{}'
) returns table (
  competitor_id uuid,
  external_id text,
  name text,
  platform_name text,
  sku_count bigint,
  brand_count bigint,
  category_count bigint,
  min_price numeric,
  median_price numeric,
  max_price numeric,
  in_stock_rate numeric,
  sold_units bigint,
  avg_rating numeric,
  rated_sku_count bigint,
  price_change_rate numeric,
  observed_sku_count bigint,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  total_identified_sku_count bigint
)
language sql
stable
security invoker
as $$
  with scoped as (
    select
      p.id,
      p.platform_id,
      p.seller_external_id,
      p.brand,
      p.category_slug,
      p.in_stock,
      p.sold_count,
      p.rating,
      market_convert_currency(p.price, p.currency, p_target_currency, p_rates) as value
    from market_products p
    where p.is_active
      and p.seller_external_id is not null
      and p.category_slug = any(p_category_slugs)
      and p.platform_id = any(p_platform_ids)
      -- Brand filter, same rule as market_scope_price_stats: empty array
      -- means "every brand"; a null-brand row is excluded once a filter is
      -- actually set, since an unbranded row is not evidence of the brand
      -- asked about.
      and (
        coalesce(array_length(p_brands, 1), 0) = 0
        or lower(p.brand) = any(select lower(b) from unnest(p_brands) b)
      )
      and (
        p_price_min is null
        or market_convert_currency(p.price, p.currency, coalesce(p_band_currency, p_target_currency), p_rates) >= p_price_min
      )
      and (
        p_price_max is null
        or market_convert_currency(p.price, p.currency, coalesce(p_band_currency, p_target_currency), p_rates) <= p_price_max
      )
  ),
  moves as (
    select
      h.product_id,
      h.price,
      lag(h.price) over (partition by h.product_id order by h.recorded_at) as prev_price
    from market_price_history h
    where h.recorded_at >= now() - make_interval(days => p_lookback_days)
      and h.product_id in (select id from scoped)
  ),
  moves_by_product as (
    select
      product_id,
      count(*) filter (where prev_price is not null and price is distinct from prev_price) as changes,
      count(*) filter (where prev_price is not null) as observations
    from moves
    group by product_id
  ),
  grouped as (
    select
      c.id as competitor_id,
      s.seller_external_id as external_id,
      coalesce(c.name, s.seller_external_id) as name,
      pl.name as platform_name,
      count(*)::bigint as sku_count,
      count(distinct s.brand)::bigint as brand_count,
      count(distinct s.category_slug)::bigint as category_count,
      min(s.value) as min_price,
      percentile_cont(0.5) within group (order by s.value) as median_price,
      max(s.value) as max_price,
      case when count(s.in_stock) = 0 then null
           else round(count(*) filter (where s.in_stock)::numeric / count(s.in_stock), 4) end as in_stock_rate,
      coalesce(sum(s.sold_count), 0)::bigint as sold_units,
      round(avg(s.rating), 2) as avg_rating,
      count(s.rating)::bigint as rated_sku_count,
      case when coalesce(sum(m.observations), 0) = 0 then null
           else round(coalesce(sum(m.changes), 0)::numeric / sum(m.observations), 4) end as price_change_rate,
      count(m.product_id)::bigint as observed_sku_count,
      c.first_seen_at,
      c.last_seen_at
    from scoped s
    join market_platforms pl on pl.id = s.platform_id
    left join market_competitors c
      on c.platform_id = s.platform_id and c.external_id = s.seller_external_id
    left join moves_by_product m on m.product_id = s.id
    group by c.id, s.seller_external_id, c.name, pl.name, c.first_seen_at, c.last_seen_at
  )
  select
    g.competitor_id,
    g.external_id,
    g.name,
    g.platform_name,
    g.sku_count,
    g.brand_count,
    g.category_count,
    g.min_price,
    g.median_price,
    g.max_price,
    g.in_stock_rate,
    g.sold_units,
    g.avg_rating,
    g.rated_sku_count,
    g.price_change_rate,
    g.observed_sku_count,
    g.first_seen_at,
    g.last_seen_at,
    -- Sum over the *entire* grouped set, before the limit below - this is
    -- what makes it a true total rather than a sum of the visible page.
    sum(g.sku_count) over ()::bigint as total_identified_sku_count
  from grouped g
  order by g.sku_count desc
  limit p_limit;
$$;
