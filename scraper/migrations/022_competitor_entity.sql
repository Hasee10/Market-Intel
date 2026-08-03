-- ROADMAP.md C1 - the competitor entity (Block 4 of the framework).
--
-- Until now the schema had no notion of *who* sells a listing. Six of the eight
-- sources are single retailers, where the platform is the seller and the
-- distinction is meaningless; OLX carries no stable seller identity worth
-- keying on. Daraz (migration 019) is the first true marketplace here and names
-- the merchant on every listing, which is what makes a competitor addressable
-- as an entity rather than as a name repeated across rows.
--
-- Two pieces:
--
--   1. `market_competitors` - the durable entity. Derived from market_products
--      rather than scraped separately, but persisted rather than recomputed on
--      read, because the one thing a GROUP BY cannot give you is *tenure*:
--      first_seen_at survives a competitor dropping out of a category for a
--      run. "Entered this market three weeks ago" is a finding; "is here now"
--      is not.
--   2. `market_competitor_scorecards()` - the per-competitor rollup the UI
--      renders. SQL rather than JS for the same reason as migration 021.
--
-- SECURITY INVOKER throughout, so RLS on market_products still applies to the
-- aggregates. Apply manually via the Supabase SQL Editor, after 021.

-- ---------------------------------------------------------------------------
-- The entity
-- ---------------------------------------------------------------------------

create table if not exists market_competitors (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references market_platforms(id) on delete cascade,
  -- The platform's own seller id. Keyed on this rather than on the display
  -- name: sellers rename their storefronts, and two unrelated sellers can
  -- share a name.
  external_id text not null,
  name text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (platform_id, external_id)
);

create index if not exists market_competitors_platform_idx
  on market_competitors (platform_id);

alter table market_competitors enable row level security;

-- Readable by any signed-in seller: this is scraped market data, the product
-- itself, not one tenant's data. Writes are service-role only (the scraper),
-- so there is deliberately no insert/update policy here.
drop policy if exists market_competitors_select_all on market_competitors;
create policy market_competitors_select_all
  on market_competitors for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Refresh, called by the scraper after each run
-- ---------------------------------------------------------------------------
--
-- Upserts one row per (platform, seller) seen in market_products. `first_seen_at`
-- is never overwritten on conflict - that is the whole point of the table.
-- The name IS overwritten, so a rebranded storefront shows its current name
-- while keeping its history.
--
-- Runs as the caller. The scraper calls it with the service-role key; nothing
-- in the app calls it at all.

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
    -- A seller can appear under a slightly different name across listings;
    -- take the most common spelling rather than an arbitrary one.
    mode() within group (order by p.seller_name),
    min(p.first_seen_at),
    max(p.last_seen_at)
  from market_products p
  where p.seller_external_id is not null
    and p.seller_name is not null
  group by p.platform_id, p.seller_external_id
  on conflict (platform_id, external_id) do update
    set name = excluded.name,
        last_seen_at = greatest(market_competitors.last_seen_at, excluded.last_seen_at),
        first_seen_at = least(market_competitors.first_seen_at, excluded.first_seen_at);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ---------------------------------------------------------------------------
-- Per-competitor scorecard for a market scope
-- ---------------------------------------------------------------------------
--
-- One row per competitor active inside the seller's market definition
-- (ROADMAP.md A3 supplies p_category_slugs / p_platform_ids).
--
-- Only market_products feeds this - classifieds are excluded on purpose. An
-- OLX poster is not a competitor you can benchmark against; they are one
-- person selling one phone.
--
-- Repricing aggressiveness is folded in here rather than living in its own
-- function so the page is one round trip. It counts *distinct scrape runs on
-- which a product's price differed from its previous observation*, expressed as
-- a share of observations - a competitor who moved 40% of their prices in the
-- last 30 days behaves differently from one who has not moved any, and that
-- difference is the finding. It is a floor, not a true count: we observe every
-- two days, so intra-window moves that revert are invisible. The UI must say so.

create or replace function market_competitor_scorecards(
  p_category_slugs text[],
  p_platform_ids uuid[],
  p_target_currency text,
  p_rates jsonb,
  p_lookback_days integer default 30,
  p_limit integer default 25
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
  last_seen_at timestamptz
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
  ),
  -- Price movement per product over the window. `lag` over recorded_at gives
  -- the previous observation; a row where the price differs from it is a
  -- repricing event. `is distinct from` rather than `<>` so a price appearing
  -- or disappearing counts, instead of nulling the comparison out.
  moves as (
    select
      h.product_id,
      h.price,
      lag(h.price) over (partition by h.product_id order by h.recorded_at) as prev_price
    from market_price_history h
    where h.recorded_at >= now() - make_interval(days => p_lookback_days)
      and h.product_id in (select id from scoped)
  ),
  -- The first observation in the window has no predecessor, so it is neither a
  -- change nor a chance to observe one. Counting it as "no change" would make
  -- every competitor look calmer than they are.
  moves_by_product as (
    select
      product_id,
      count(*) filter (where prev_price is not null and price is distinct from prev_price) as changes,
      count(*) filter (where prev_price is not null) as observations
    from moves
    group by product_id
  )
  select
    c.id,
    s.seller_external_id,
    coalesce(c.name, s.seller_external_id),
    pl.name,
    count(*)::bigint,
    count(distinct s.brand)::bigint,
    count(distinct s.category_slug)::bigint,
    min(s.value),
    percentile_cont(0.5) within group (order by s.value),
    max(s.value),
    -- Null in_stock means the source does not report stock, which is not the
    -- same as out of stock. Rate over the rows that do report it, null if none.
    case when count(s.in_stock) = 0 then null
         else round(count(*) filter (where s.in_stock)::numeric / count(s.in_stock), 4) end,
    coalesce(sum(s.sold_count), 0)::bigint,
    round(avg(s.rating), 2),
    count(s.rating)::bigint,
    case when coalesce(sum(m.observations), 0) = 0 then null
         else round(coalesce(sum(m.changes), 0)::numeric / sum(m.observations), 4) end,
    count(m.product_id)::bigint,
    c.first_seen_at,
    c.last_seen_at
  from scoped s
  join market_platforms pl on pl.id = s.platform_id
  left join market_competitors c
    on c.platform_id = s.platform_id and c.external_id = s.seller_external_id
  left join moves_by_product m on m.product_id = s.id
  group by c.id, s.seller_external_id, c.name, pl.name, c.first_seen_at, c.last_seen_at
  order by count(*) desc
  limit p_limit;
$$;

-- Supports the scorecard grouping. The existing
-- market_products_platform_seller_idx (migration 019) is keyed the other way
-- round and does not help a category-scoped scan.
create index if not exists market_products_seller_scope_idx
  on market_products (category_slug, platform_id, seller_external_id)
  where is_active and seller_external_id is not null;
