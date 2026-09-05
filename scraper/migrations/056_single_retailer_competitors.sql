-- Treats a genuinely single-retailer platform as one competitor, instead of
-- excluding it from the Competitors page entirely.
--
-- market_refresh_competitors() (022) has only ever inserted a row where
-- `seller_external_id is not null` - correct for Daraz, where many sellers
-- share one marketplace and the id is the only thing that tells them apart,
-- but wrong for a site like Coffee Crest or Red Berry Roasters, where the
-- retailer IS the platform. Those sources were never missing an identity to
-- enrich - the platform name already names the competitor completely, and
-- always has. Excluding them made the Competitors and Explore pages say "no
-- named competitors" for entire categories that are, in reality, served by
-- three or four fully identifiable retailers.
--
-- market_single_retailer_platforms() is the one place that decides which
-- platforms this applies to: a platform where EVERY market_products row
-- ever recorded has a null seller_external_id. Not filtered to is_active -
-- this is meant to be a stable classification of what the platform IS
-- (a marketplace or a single storefront), not something that flips back and
-- forth with which listings happen to be active this run. A platform that
-- is a genuine marketplace but has a partial attribution gap on some
-- listings does NOT qualify here (bool_and requires every row), so those
-- listings correctly stay anonymous rather than being folded into a
-- synthetic competitor - unchanged from today's behaviour.
--
-- The synthetic competitor's external_id is the literal string '__self__',
-- which can never collide with a real scraped seller_external_id (those are
-- merchant slugs/ids from Daraz's own data, never this literal).
--
-- No return-type changes anywhere, so no function needs dropping first -
-- market_competitor_scorecards keeps 040's exact 11-argument, 18-column
-- signature; only its body changes.
--
-- Apply manually via the Supabase SQL Editor, after 040.

-- ---------------------------------------------------------------------------
-- Shared classification, so the three functions below cannot drift apart on
-- which platforms qualify.
-- ---------------------------------------------------------------------------

create or replace function market_single_retailer_platforms()
returns table (platform_id uuid)
language sql
stable
security invoker
as $$
  select platform_id
  from market_products
  group by platform_id
  having bool_and(seller_external_id is null);
$$;

-- ---------------------------------------------------------------------------
-- Refresh: one row per single-retailer platform, alongside the existing
-- one row per (platform, seller).
-- ---------------------------------------------------------------------------

create or replace function market_refresh_competitors()
returns integer
language plpgsql
security invoker
as $$
declare
  affected integer;
begin
  insert into market_competitors (platform_id, external_id, name, first_seen_at, last_seen_at)
  select
    p.platform_id,
    p.seller_external_id,
    mode() within group (order by p.seller_name),
    min(p.first_seen_at),
    max(p.last_seen_at)
  from market_products p
  where p.seller_external_id is not null
    and p.seller_name is not null
  group by p.platform_id, p.seller_external_id

  union all

  -- The platform IS the seller here, so its own name is the competitor's
  -- name - nothing to take a mode() over. Scoped to is_active for the
  -- min/max dates: first_seen_at/last_seen_at should track this platform's
  -- actual presence in the market, the same as the marketplace branch above
  -- effectively does (a seller's rows are overwhelmingly active in
  -- practice). Only platforms market_single_retailer_platforms() actually
  -- classifies as single-retailer produce a row - the join is a filter, not
  -- a data source.
  select
    pl.id,
    '__self__',
    pl.name,
    min(p.first_seen_at),
    max(p.last_seen_at)
  from market_products p
  join market_platforms pl on pl.id = p.platform_id
  where p.is_active
    and pl.id in (select platform_id from market_single_retailer_platforms())
  group by pl.id, pl.name

  on conflict (platform_id, external_id) do update
    set name = excluded.name,
        last_seen_at = greatest(market_competitors.last_seen_at, excluded.last_seen_at),
        first_seen_at = least(market_competitors.first_seen_at, excluded.first_seen_at);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scorecards: a single-retailer platform's whole in-scope catalogue becomes
-- one row, keyed by the '__self__' sentinel.
-- ---------------------------------------------------------------------------

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
  with single_retailer as (
    select platform_id from market_single_retailer_platforms()
  ),
  scoped as (
    select
      p.id,
      p.platform_id,
      -- The join key every downstream reference uses. Real marketplace
      -- sellers keep their own id; a single-retailer platform's entire
      -- catalogue collapses onto the one sentinel row created for it above,
      -- which is exactly what turns "58 individually-anonymous listings"
      -- into "one named competitor with 58 SKUs".
      coalesce(p.seller_external_id, '__self__') as effective_external_id,
      p.brand,
      p.category_slug,
      p.in_stock,
      p.sold_count,
      p.rating,
      market_convert_currency(p.price, p.currency, p_target_currency, p_rates) as value
    from market_products p
    where p.is_active
      and (
        p.seller_external_id is not null
        or p.platform_id in (select platform_id from single_retailer)
      )
      and p.category_slug = any(p_category_slugs)
      and p.platform_id = any(p_platform_ids)
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
      s.effective_external_id as external_id,
      coalesce(c.name, s.effective_external_id) as name,
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
      on c.platform_id = s.platform_id and c.external_id = s.effective_external_id
    left join moves_by_product m on m.product_id = s.id
    group by c.id, s.effective_external_id, c.name, pl.name, c.first_seen_at, c.last_seen_at
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
    sum(g.sku_count) over ()::bigint as total_identified_sku_count
  from grouped g
  order by g.sku_count desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Anonymous count: must exclude single-retailer platforms now that their
-- listings are identified, or "N listings carry no seller identity" double-
-- counts every one of them alongside the new scorecard rows.
--
-- This used to be a plain PostgREST count with no SQL function of its own
-- (competitors.ts built it inline as `.is('seller_external_id', null)`).
-- Given it now has to share market_single_retailer_platforms()'s
-- classification, it needs to live in SQL too, rather than duplicating that
-- classification's logic a second time in TypeScript where it could drift
-- from the version the scorecard function uses.
-- ---------------------------------------------------------------------------

create or replace function market_anonymous_sku_count(
  p_category_slugs text[],
  p_platform_ids uuid[]
) returns bigint
language sql
stable
security invoker
as $$
  select count(*)::bigint
  from market_products p
  where p.is_active
    and p.seller_external_id is null
    and p.category_slug = any(p_category_slugs)
    and p.platform_id = any(p_platform_ids)
    -- The only listings still counted as anonymous: ones on a platform that
    -- DOES attribute other listings to real sellers, where this particular
    -- one simply has no seller_external_id - a genuine attribution gap, not
    -- a single-retailer platform (which now has its own named competitor
    -- row above and is no longer "anonymous" at all).
    and p.platform_id not in (select platform_id from market_single_retailer_platforms());
$$;
