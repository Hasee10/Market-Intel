-- Implements the correctness/scalability findings from an architecture
-- review of the report generation system (Grok, cross-checked against the
-- live repo/DB before implementing - see docs/reports-v2-architecture.md).
--
-- Three independent changes, all safe to apply to the live table (no data
-- rewrite, no partitioning - that's drafted separately in
-- _future_market_price_history_partitioning.sql and deliberately not
-- applied yet, since current volume doesn't warrant the operational risk):
--
--   1. market_scope_price_stats now withholds p25/p75 below a minimum
--      sample size, instead of trusting every caller to check row_count
--      themselves before using them.
--   2. Two indexes on market_price_history for the access patterns the
--      trend/pricing functions already use.
--   3. A unique index enforcing one history row per product per calendar
--      day, so a retried scrape batch becomes a safe no-op instead of a
--      duplicate that skews market_scope_price_trend's daily buckets.
--
-- Apply manually via the Supabase SQL Editor (or psql against the pooler
-- connection string in CREDENTIALS.txt if the Supabase MCP is - again -
-- connected to the wrong account; see mind.md), same convention as 001-025.

-- ---------------------------------------------------------------------------
-- 1. Sample-size guard inside market_scope_price_stats itself
-- ---------------------------------------------------------------------------

-- 15 matches the threshold the app already enforced independently in
-- lib/reports/collectors/marketplace-and-pricing.ts before this migration -
-- moving it into the function means every caller gets the same guard for
-- free, not just the report pipeline. median/row_count/min/max/avg stay
-- populated at any sample size >= 1 - only the percentile band, which
-- implies more precision than a handful of listings can support, is gated.
--
-- `create or replace function` only replaces a function with the exact
-- same parameter list - adding p_min_sample_for_band below creates a
-- second overload instead of replacing the original 021 signature, leaving
-- two ambiguous candidates for any 9-argument call. Drop the old signature
-- explicitly first.
drop function if exists market_scope_price_stats(text[], uuid[], text, jsonb, text, numeric, numeric, text[], text[]);

create or replace function market_scope_price_stats(
  p_category_slugs text[],
  p_platform_ids uuid[],
  p_target_currency text,
  p_rates jsonb,
  p_band_currency text default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_brands text[] default '{}',
  p_cities text[] default '{}',
  p_min_sample_for_band integer default 15
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
      (coalesce(array_length(p_brands, 1), 0) = 0 or lower(brand) = any(select lower(b) from unnest(p_brands) b))
      and (coalesce(array_length(p_cities, 1), 0) = 0 or city is null
           or lower(city) = any(select lower(c) from unnest(p_cities) c))
      and (p_price_min is null
           or market_convert_currency(price, currency, coalesce(p_band_currency, p_target_currency), p_rates) >= p_price_min)
      and (p_price_max is null
           or market_convert_currency(price, currency, coalesce(p_band_currency, p_target_currency), p_rates) <= p_price_max)
  )
  select
    count(*)::bigint as row_count,
    min(value) as min_price,
    case when count(*) >= p_min_sample_for_band
      then percentile_cont(0.25) within group (order by value)
      else null end as p25,
    percentile_cont(0.5) within group (order by value) as median,
    case when count(*) >= p_min_sample_for_band
      then percentile_cont(0.75) within group (order by value)
      else null end as p75,
    max(value) as max_price,
    avg(value) as avg_price,
    array_agg(distinct platform_name) as platform_names
  from filtered;
$$;

-- ---------------------------------------------------------------------------
-- 2. Indexes for market_price_history's actual access patterns
-- ---------------------------------------------------------------------------

-- Append-only table, physical insert order correlates with recorded_at -
-- BRIN is the right index type here (tiny, cheap to maintain) for range
-- scans like market_scope_price_trend's lookback-window filter.
create index if not exists market_price_history_recorded_at_brin
  on market_price_history using brin (recorded_at);

-- Covering the "latest N points for product X" pattern (the Pricing
-- Intelligence report section, the trend function's per-product join).
create index if not exists market_price_history_product_recorded_idx
  on market_price_history (product_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- 3. Idempotent history writes - one row per product per calendar day
-- ---------------------------------------------------------------------------

-- scraper/src/db.ts's saveProducts() previously did a plain insert with no
-- conflict target, so a retried batch (or two runs landing on the same
-- day) created duplicate rows that double-weighted that day's median in
-- market_scope_price_trend's daily buckets. One row per product per day is
-- the same granularity the trend function already buckets by, so this is
-- the correct dedup key, not an arbitrary choice.
--
-- A real generated column, not just an expression index: PostgREST's
-- upsert support (`Prefer: resolution=ignore-duplicates` +
-- `on_conflict=...`) can only target plain column names, not arbitrary
-- expressions - `on_conflict=product_id,(recorded_at::date)` is not
-- something PostgREST/Postgres's ON CONFLICT clause accepts. A stored
-- generated column gives db.ts a real column to name.
--
-- Postgres's built-in `timestamptz -> date` cast is marked STABLE, not
-- IMMUTABLE (it depends on the session's TimeZone setting), so it can't be
-- used directly in a generated column's expression - "generation
-- expression is not immutable". A small wrapper function pinned to UTC
-- sidesteps this: Postgres trusts an explicit `immutable` declaration on a
-- user-defined function rather than re-deriving it, and the result really
-- is deterministic given a fixed zone. recorded_at is always written as a
-- UTC ISO timestamp by the scraper (`new Date().toISOString()`), so UTC is
-- also the semantically correct zone here, not an arbitrary pick to
-- satisfy Postgres.
create or replace function market_price_history_date_utc(ts timestamptz)
returns date
language sql
immutable
as $$
  select (ts at time zone 'utc')::date;
$$;

alter table market_price_history
  add column if not exists recorded_date date generated always as (market_price_history_date_utc(recorded_at)) stored;

-- One-time cleanup: historical data written before this constraint existed
-- has real (product_id, day) duplicates (multiple scrape runs on the same
-- day, before db.ts's on_conflict/ignore-duplicates fix). Keep the most
-- recent row per day - the freshest observation is the most representative
-- one - and drop the rest before the unique index below can be created.
-- (recorded_at, id) tiebreak, not recorded_at alone: two rows inserted in
-- the same batch can share an identical recorded_at (db.ts sets one `now`
-- per batch), which a strict `<` on recorded_at alone would let both survive.
delete from market_price_history mph
using market_price_history newer
where mph.product_id = newer.product_id
  and mph.recorded_date = newer.recorded_date
  and (mph.recorded_at, mph.id) < (newer.recorded_at, newer.id);

create unique index if not exists market_price_history_product_day_uidx
  on market_price_history (product_id, recorded_date);
