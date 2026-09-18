-- Where a listing sits within its category on the demand signals the
-- scraper captures.
--
-- "Search volume (how many clicks done)" on the product notes (2026-09-18).
-- No marketplace here publishes searches or clicks, so this is the honest
-- proxy: for a given set of listings, their percentile within the whole
-- in-scope category on sold_count, rating_count, and page position (rank
-- from migration 060). A listing in the 90th percentile on sold count is
-- selling more than nine in ten listings in its category - which is what
-- "how much demand is there for this" means when the only evidence is
-- what the platforms report.
--
-- Percentiles are computed over every active listing in scope, not just
-- the requested ones, so the number means the same thing regardless of how
-- many products the caller asks about. Nulls are excluded from each
-- signal's population and returned as null for that listing, rather than
-- sorted to the bottom as a fake zero: "not reported" and "reported zero"
-- are different facts.
--
-- Page position uses each listing's most recent ranked observation in the
-- last 7 days. Rank is lower-is-better, so its percentile is inverted -
-- rank_pct = 0.9 means the listing sits higher on the page than 90% of the
-- category. Rank only exists from 2026-09-18 onward (060); before a
-- listing has a ranked observation its rank_pct is null and the caller's
-- weighting drops it.
--
-- security invoker; market_* tables are readable by any authenticated
-- seller (012), so RLS is not the concern here - scope is, and the caller
-- passes it explicitly (same convention as market_competitor_scorecards).
--
-- Apply manually via the Supabase SQL Editor. Depends on 060 for the rank
-- column; safe to apply before any ranked rows exist.

create or replace function market_demand_percentiles(
  p_category_slugs text[],
  p_platform_ids uuid[],
  p_product_ids uuid[]
) returns table (
  product_id uuid,
  sold_count integer,
  rating_count integer,
  latest_rank integer,
  sold_pct numeric,
  reviews_pct numeric,
  rank_pct numeric,
  category_listings bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with scope as (
    select mp.id, mp.sold_count, mp.rating_count
    from market_products mp
    where mp.is_active
      and mp.category_slug = any (p_category_slugs)
      and mp.platform_id = any (p_platform_ids)
  ),
  latest_rank as (
    select distinct on (h.product_id) h.product_id, h.rank
    from market_price_history h
    join scope s on s.id = h.product_id
    where h.rank is not null
      and h.recorded_at >= now() - interval '7 days'
    order by h.product_id, h.recorded_at desc
  ),
  ranked as (
    select
      s.id,
      s.sold_count,
      s.rating_count,
      lr.rank as latest_rank,
      case when s.sold_count is not null
           then percent_rank() over (partition by (s.sold_count is not null) order by s.sold_count)
      end as sold_pct,
      case when s.rating_count is not null
           then percent_rank() over (partition by (s.rating_count is not null) order by s.rating_count)
      end as reviews_pct,
      case when lr.rank is not null
           then percent_rank() over (partition by (lr.rank is not null) order by lr.rank desc)
      end as rank_pct,
      count(*) over () as category_listings
    from scope s
    left join latest_rank lr on lr.product_id = s.id
  )
  select
    r.id,
    r.sold_count,
    r.rating_count,
    r.latest_rank,
    round(r.sold_pct::numeric, 3),
    round(r.reviews_pct::numeric, 3),
    round(r.rank_pct::numeric, 3),
    r.category_listings
  from ranked r
  where r.id = any (p_product_ids);
$$;

comment on function market_demand_percentiles(text[], uuid[], uuid[]) is
  'Percentile of each requested listing within its in-scope category on sold_count, rating_count and latest page rank (inverted, higher = better placed). Nulls excluded from each population and returned as null. The demand-index proxy for "search volume".';
