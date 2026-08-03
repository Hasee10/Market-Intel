-- ROADMAP.md A4 - push aggregation into SQL.
--
-- getCategoryPricing() and getPriceTrend() both worked the same way: pull every
-- in-scope row out of Postgres, convert currencies in JS, sort the array, and
-- index into it for percentiles. That is fine at 5,651 products and stops being
-- fine well before it becomes obvious - market_price_history in particular grows
-- by one row per product per scrape run, every two days, forever.
--
-- These two functions do the same arithmetic in the database and return a
-- handful of rows instead of thousands.
--
-- Both are SECURITY INVOKER (the default, stated explicitly here because it
-- matters): they run as the calling user, so RLS on market_products and
-- market_classified_listings still applies. A SECURITY DEFINER function here
-- would be a hole - it would let any authenticated caller aggregate rows the
-- policies say they cannot read.
--
-- Apply manually via the Supabase SQL Editor, after 020.

-- ---------------------------------------------------------------------------
-- FX conversion, shared by both functions
-- ---------------------------------------------------------------------------
--
-- Mirrors convertCurrency() in src/lib/market-intel/fx.ts exactly, including
-- its failure mode: if either rate is missing, return the amount unconverted
-- rather than raising. A stale FX snapshot should leave the dashboard slightly
-- wrong until the next cron run, not break it. The rates come in as jsonb from
-- the caller rather than being read from fx_rates here, so that one snapshot is
-- used consistently across every query in a single page render.

create or replace function market_convert_currency(
  p_amount numeric,
  p_from text,
  p_to text,
  p_rates jsonb
) returns numeric
language sql
immutable
parallel safe
as $$
  select case
    when p_amount is null then null
    when p_from = p_to then p_amount
    when (p_rates ->> p_from) is null or (p_rates ->> p_to) is null then p_amount
    when (p_rates ->> p_from)::numeric = 0 then p_amount
    else p_amount / (p_rates ->> p_from)::numeric * (p_rates ->> p_to)::numeric
  end;
$$;

-- ---------------------------------------------------------------------------
-- Price distribution for a market scope
-- ---------------------------------------------------------------------------
--
-- Unions market_products (retailer marketplaces) and market_classified_listings
-- (OLX) the same way getCategoryPricing() did, because several seller
-- categories have only classifieds coverage.
--
-- Two currencies are in play and conflating them was a real bug risk: the price
-- band is whatever the seller typed into the market-definition editor
-- (p_band_currency), while the returned percentiles are in the seller's
-- reporting currency (p_target_currency). A PKR listing must be compared
-- against a band entered in USD, not against the raw number.

create or replace function market_scope_price_stats(
  p_category_slugs text[],
  p_platform_ids uuid[],
  p_target_currency text,
  p_rates jsonb,
  p_band_currency text default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_brands text[] default '{}',
  p_cities text[] default '{}'
) returns table (
  row_count bigint,
  min_price numeric,
  p25 numeric,
  median numeric,
  p75 numeric,
  max_price numeric,
  avg_price numeric,
  platform_names text[]
)
language sql
stable
security invoker
as $$
  with scoped as (
    select
      p.price,
      p.currency,
      p.brand,
      null::text as city,
      pl.name as platform_name
    from market_products p
    join market_platforms pl on pl.id = p.platform_id
    where p.is_active
      and p.price is not null
      and p.category_slug = any(p_category_slugs)
      and p.platform_id = any(p_platform_ids)

    union all

    select
      l.price,
      l.currency,
      null::text as brand,
      l.city,
      pl.name as platform_name
    from market_classified_listings l
    join market_platforms pl on pl.id = l.platform_id
    where l.status = 'active'
      and l.price is not null
      and l.category_slug = any(p_category_slugs)
      and l.platform_id = any(p_platform_ids)
  ),
  filtered as (
    select
      market_convert_currency(price, currency, p_target_currency, p_rates) as value,
      platform_name
    from scoped
    where
      -- Brand filter: empty array means "every brand". Retailer rows with a
      -- null brand are excluded once a filter is set, which is correct - an
      -- unbranded row is not evidence of the brand you asked about.
      (coalesce(array_length(p_brands, 1), 0) = 0 or lower(brand) = any(select lower(b) from unnest(p_brands) b))
      -- City filter: classifieds only. A retailer row has no geography, so a
      -- city filter must not silently delete it from the market.
      and (coalesce(array_length(p_cities, 1), 0) = 0 or city is null
           or lower(city) = any(select lower(c) from unnest(p_cities) c))
      and (p_price_min is null
           or market_convert_currency(price, currency, coalesce(p_band_currency, p_target_currency), p_rates) >= p_price_min)
      and (p_price_max is null
           or market_convert_currency(price, currency, coalesce(p_band_currency, p_target_currency), p_rates) <= p_price_max)
  )
  select
    count(*)::bigint,
    min(value),
    percentile_cont(0.25) within group (order by value),
    percentile_cont(0.5) within group (order by value),
    percentile_cont(0.75) within group (order by value),
    max(value),
    avg(value),
    array_agg(distinct platform_name)
  from filtered;
$$;

-- ---------------------------------------------------------------------------
-- Daily median price over time for a market scope
-- ---------------------------------------------------------------------------
--
-- This is the one that actually needed moving. getPriceTrend() used to select
-- every matching product id, then pass that whole array back in as an `.in()`
-- filter on market_price_history - a query whose URL length grew with the size
-- of the seller's market. It is now a single join.

create or replace function market_scope_price_trend(
  p_category_slugs text[],
  p_platform_ids uuid[],
  p_target_currency text,
  p_rates jsonb,
  p_lookback_days integer default 30
) returns table (
  bucket_date date,
  median_price numeric
)
language sql
stable
security invoker
as $$
  select
    h.recorded_at::date as bucket_date,
    percentile_cont(0.5) within group (
      order by market_convert_currency(h.price, p.currency, p_target_currency, p_rates)
    ) as median_price
  from market_price_history h
  join market_products p on p.id = h.product_id
  where h.price is not null
    and h.recorded_at >= now() - make_interval(days => p_lookback_days)
    and p.category_slug = any(p_category_slugs)
    and p.platform_id = any(p_platform_ids)
  group by 1
  order by 1;
$$;

-- Supports the join above. market_price_history is the fastest-growing table in
-- the schema (one row per product per scrape run) and this is the only access
-- pattern that reads it in bulk.
create index if not exists market_price_history_recorded_at_idx
  on market_price_history (recorded_at desc);

-- Percentile/lookup support for the scope queries. The partial predicates match
-- the WHERE clauses above so the planner can use them directly.
create index if not exists market_products_scope_idx
  on market_products (category_slug, platform_id)
  where is_active and price is not null;

create index if not exists market_classified_listings_scope_idx
  on market_classified_listings (category_slug, platform_id)
  where status = 'active' and price is not null;
