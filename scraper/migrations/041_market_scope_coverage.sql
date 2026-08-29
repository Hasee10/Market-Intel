-- Fixes the market scope banner counting a different market than the page
-- below it (code audit, 2026-08-29).
--
-- getMarketScopeCoverage() (market-definition.ts) counted category_slug +
-- platform_id only - never price band, brands, or cities - while
-- getCategoryPricing() right below it on the same page passes all of them to
-- market_scope_price_stats (021). Two concrete harms: the banner overstated
-- how much evidence backs the numbers on the page (band-filtered figures
-- computed over a fraction of the count actually shown), and it inverted the
-- product's own empty-state rule - when a band matched zero rows,
-- getCategoryPricing returned null and the page went blank, but the banner's
-- unfiltered count was still positive, so `empty` never triggered and the
-- honest "no listings match your definition" message never fired.
--
-- Rather than duplicating market_scope_price_stats's filter block a second
-- time in PostgREST query syntax (a second place for the two to drift apart
-- again), this is one SQL function sharing the identical filtered CTE
-- pattern, so the banner and the stats/competitor calls are structurally
-- guaranteed to agree - the same fix shape as 040.
--
-- market_products and market_classified_listings are counted separately
-- (not unioned into one total) because MarketDefinitionEditor.tsx shows them
-- as two distinct lines ("N retailer products" / "M classified listings"),
-- unlike market_scope_price_stats which only ever needed one combined
-- distribution.
--
-- Apply manually via the Supabase SQL Editor, after 021 (needs
-- market_convert_currency).

create or replace function market_scope_coverage(
  p_category_slugs text[],
  p_platform_ids uuid[],
  p_band_currency text,
  p_rates jsonb,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_brands text[] default '{}',
  p_cities text[] default '{}'
) returns table (
  product_count bigint,
  listing_count bigint,
  platform_ids uuid[]
)
language sql
stable
security invoker
as $$
  with scoped as (
    select
      'product'::text as source_type,
      p.platform_id,
      p.price,
      p.currency,
      p.brand,
      null::text as city
    from market_products p
    where p.is_active
      and p.category_slug = any(p_category_slugs)
      and p.platform_id = any(p_platform_ids)

    union all

    select
      'listing'::text as source_type,
      l.platform_id,
      l.price,
      l.currency,
      null::text as brand,
      l.city
    from market_classified_listings l
    where l.status = 'active'
      and l.category_slug = any(p_category_slugs)
      and l.platform_id = any(p_platform_ids)
  ),
  filtered as (
    select platform_id, source_type
    from scoped
    where
      (coalesce(array_length(p_brands, 1), 0) = 0 or lower(brand) = any(select lower(b) from unnest(p_brands) b))
      and (coalesce(array_length(p_cities, 1), 0) = 0 or city is null
           or lower(city) = any(select lower(c) from unnest(p_cities) c))
      and (
        price is null
        or p_price_min is null
        or market_convert_currency(price, currency, p_band_currency, p_rates) >= p_price_min
      )
      and (
        price is null
        or p_price_max is null
        or market_convert_currency(price, currency, p_band_currency, p_rates) <= p_price_max
      )
  )
  select
    count(*) filter (where source_type = 'product')::bigint,
    count(*) filter (where source_type = 'listing')::bigint,
    array_agg(distinct platform_id)
  from filtered;
$$;
