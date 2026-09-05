-- Adds the P25-P75 band to market_scope_price_trend, per day, so the
-- seller's own price history can be plotted against the market's spread
-- over time rather than just its median.
--
-- market_scope_price_stats (021, hardened in 026) already withholds p25/p75
-- below MIN_SAMPLE_FOR_BAND (15) as a snapshot; the trend function had no
-- such guard because it never returned a band at all. This applies the
-- identical threshold per bucket-day, for the identical reason: a
-- percentile computed from a handful of same-day observations implies more
-- precision than the sample supports, and a market with sparse daily
-- coverage would otherwise show a band that is mostly sampling noise
-- dressed up as market structure.
--
-- row_count travels with every bucket (not just the gated ones) so the app
-- can distinguish "no band, thin day" from "no band, no data" without a
-- second call.
--
-- create or replace cannot add a column to an existing table-returning
-- function's signature - Postgres errors "cannot change return type of
-- existing function" - so the old 5-argument/2-column signature is dropped
-- first, same lesson as migrations 040/051.
--
-- Apply manually via the Supabase SQL Editor, after 021.

drop function if exists market_scope_price_trend(text[], uuid[], text, jsonb, integer);

create or replace function market_scope_price_trend(
  p_category_slugs text[],
  p_platform_ids uuid[],
  p_target_currency text,
  p_rates jsonb,
  p_lookback_days integer default 30,
  p_min_sample_for_band integer default 15
) returns table (
  bucket_date date,
  row_count bigint,
  p25 numeric,
  median_price numeric,
  p75 numeric
)
language sql
stable
security invoker
as $$
  select
    h.recorded_at::date as bucket_date,
    count(*) as row_count,
    case when count(*) >= p_min_sample_for_band then
      percentile_cont(0.25) within group (
        order by market_convert_currency(h.price, p.currency, p_target_currency, p_rates)
      )
    end as p25,
    percentile_cont(0.5) within group (
      order by market_convert_currency(h.price, p.currency, p_target_currency, p_rates)
    ) as median_price,
    case when count(*) >= p_min_sample_for_band then
      percentile_cont(0.75) within group (
        order by market_convert_currency(h.price, p.currency, p_target_currency, p_rates)
      )
    end as p75
  from market_price_history h
  join market_products p on p.id = h.product_id
  where h.price is not null
    and h.recorded_at >= now() - make_interval(days => p_lookback_days)
    and p.category_slug = any(p_category_slugs)
    and p.platform_id = any(p_platform_ids)
  group by 1
  order by 1;
$$;
