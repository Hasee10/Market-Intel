-- Which migrations are actually live? Paste into the Supabase SQL Editor.
--
-- This project has no schema_migrations table - migrations are applied by
-- hand (the convention noted throughout memory.md), so the only way to
-- answer "is NNN applied" is to look for the object it creates.
--
-- READ-ONLY. Every statement is a catalog SELECT; nothing is created,
-- altered or dropped. Safe to run against production.
--
-- Three caveats worth reading before trusting a row:
--
-- 1. Several migrations are `create or replace` over a function that
--    already existed, so "the function exists" proves the EARLIER
--    migration, not this one. Those rows check the return signature or
--    body for what the migration actually added. Marked (sig).
-- 2. Data/seed migrations (new retailer sources, category-map widening)
--    create no schema object at all. They are checked by row counts and
--    are marked (data) - a low count means "probably not applied", not a
--    certainty, since rows can also be removed by later cleanup.
-- 3. Migrations that only add a column to a table are checked by that
--    column. If a later migration drops it, this would read as missing.

with checks as (

  ---------- schema objects: tables ----------
  select '001_create_market_tables' as migration, 'table' as kind,
         to_regclass('public.market_platforms') is not null as applied
  union all select '007_classified_listings', 'table',
         to_regclass('public.market_classified_listings') is not null
  union all select '009_product_matches', 'table',
         to_regclass('public.market_product_matches') is not null
  union all select '011_seller_platform_tables', 'table',
         to_regclass('public.seller_categories') is not null
  union all select '014_seller_watchlists', 'table',
         to_regclass('public.seller_watchlists') is not null
  union all select '015_seller_referrals', 'table',
         to_regclass('public.seller_referrals') is not null
  union all select '017_fx_rates', 'table',
         to_regclass('public.fx_rates') is not null
  union all select '020_market_category_map', 'table',
         to_regclass('public.market_category_map') is not null
  union all select '022_competitor_entity', 'table',
         to_regclass('public.market_competitors') is not null
  union all select '025_report_snapshots', 'table',
         to_regclass('public.report_snapshots') is not null
  union all select '028_seller_product_competitor_matches', 'table',
         to_regclass('public.seller_product_competitor_matches') is not null
  union all select '030_seller_product_price_history', 'table',
         to_regclass('public.seller_product_price_history') is not null
  union all select '031_market_product_reviews', 'table',
         to_regclass('public.market_product_reviews') is not null
  union all select '052_seller_devices', 'table',
         to_regclass('public.seller_devices') is not null

  ---------- schema objects: columns ----------
  union all select '008_is_active', 'column', exists (
    select 1 from information_schema.columns
    where table_name='market_products' and column_name='is_active')
  union all select '010_gallery_urls', 'column', exists (
    select 1 from information_schema.columns
    where table_name='market_products' and column_name='gallery_urls')
  union all select '016_seller_product_currency', 'column', exists (
    select 1 from information_schema.columns
    where table_name='seller_products' and column_name='currency')
  union all select '017_reporting_currency', 'column', exists (
    select 1 from information_schema.columns
    where table_name='sellers' and column_name='reporting_currency')
  union all select '019_daraz_seller_fields', 'column', exists (
    select 1 from information_schema.columns
    where table_name='market_products' and column_name='seller_external_id')
  -- 024 adds website to seller_public_profile (the marketing showcase),
  -- not to market_competitors - no migration adds a website column there.
  -- This row used to check the wrong table and reported MISSING forever.
  union all select '024_seller_marketing_showcase', 'column', exists (
    select 1 from information_schema.columns
    where table_name='seller_public_profile' and column_name='website')
  union all select '027_country_and_import_key', 'column', exists (
    select 1 from information_schema.columns
    where table_name='sellers' and column_name='country')
  union all select '031_reviews_scraped_at', 'column', exists (
    select 1 from information_schema.columns
    where table_name='market_products' and column_name='reviews_scraped_at')
  union all select '049_seller_product_image_url', 'column', exists (
    select 1 from information_schema.columns
    where table_name='seller_products' and column_name='image_url')
  union all select '053_notification_push_delivery', 'column', exists (
    select 1 from information_schema.columns
    where table_name='seller_notifications' and column_name='pushed_at')
  union all select '060_price_history_rank', 'column', exists (
    select 1 from information_schema.columns
    where table_name='market_price_history' and column_name='rank')

  ---------- schema objects: functions ----------
  union all select '021_market_convert_currency', 'function',
         exists (select 1 from pg_proc where proname='market_convert_currency')
  union all select '024_top_market_brands', 'function',
         exists (select 1 from pg_proc where proname='top_market_brands')
  union all select '026_market_scope_price_stats', 'function',
         exists (select 1 from pg_proc where proname='market_scope_price_stats')
  union all select '036_trigram_candidate_search', 'function',
         exists (select 1 from pg_proc where proname='market_top_similar_candidates')
  union all select '041_market_scope_coverage', 'function',
         exists (select 1 from pg_proc where proname='market_scope_coverage')
  union all select '043_market_price_baseline', 'function',
         exists (select 1 from pg_proc where proname='market_scope_price_baseline')
  union all select '044_price_history_trigger', 'function',
         exists (select 1 from pg_proc where proname='record_seller_product_price_history')
  union all select '047_batch_similar_candidates', 'function',
         exists (select 1 from pg_proc where proname='market_top_similar_candidates_batch')
  union all select '050_seller_product_image_match', 'function',
         exists (select 1 from pg_proc where proname='market_images_for_titles')
  union all select '055_stock_out_durations', 'function',
         exists (select 1 from pg_proc where proname='market_stock_out_durations')
  union all select '056_single_retailer_competitors', 'function',
         exists (select 1 from pg_proc where proname='market_single_retailer_platforms')
  union all select '059_seller_cohort_retention', 'function',
         exists (select 1 from pg_proc where proname='seller_cohort_retention')

  ---------- (sig) replaces an existing function - check what it ADDED ----------
  -- The parameter 040 adds is p_price_min (see the migration), not
  -- p_min_price. This row searched for the wrong name and reported
  -- MISSING regardless of state - the second such row in this file.
  union all select '040_scorecards_band_filters', 'function (sig)', exists (
    select 1 from pg_proc
    where proname='market_competitor_scorecards'
      and pg_get_functiondef(oid) ilike '%p_price_min%')
  union all select '051_candidate_search_image_url', 'function (sig)', exists (
    select 1 from pg_proc
    where proname='market_top_similar_candidates'
      and pg_get_function_result(oid) like '%image_url%')
  union all select '054_price_trend_band', 'function (sig)', exists (
    select 1 from pg_proc
    where proname='market_scope_price_trend'
      and pg_get_function_result(oid) like '%p25%')

  ---------- schema objects: indexes ----------
  union all select '036_title_trgm_index', 'index',
         exists (select 1 from pg_indexes where indexname='market_products_title_trgm_idx')
  union all select '048_candidate_composite_index', 'index',
         exists (select 1 from pg_indexes where indexname='market_products_cat_plat_title_trgm_idx')
  union all select '057_top_market_brands_index', 'index',
         exists (select 1 from pg_indexes where indexname='idx_market_products_brand_active')

  ---------- schema objects: RLS policies ----------
  union all select '012_seller_rls', 'policy', exists (
    select 1 from pg_policies where tablename='sellers' and policyname='sellers_select_own')
  union all select '042_market_tables_rls', 'policy', exists (
    select 1 from pg_policies
    where tablename='market_products' and policyname='market_products_select_anon')
  union all select '058_market_platforms_anon_read', 'policy', exists (
    select 1 from pg_policies
    where tablename='market_platforms' and policyname='market_platforms_select_anon')
)
select migration, kind,
       case when applied then 'APPLIED' else '*** MISSING ***' end as status
from checks
order by migration;

-- ---------------------------------------------------------------------
-- (data) seed migrations - no schema object, so judge these by counts.
-- Run separately; compare against the numbers in each migration's header
-- and in memory.md. A low count suggests not-applied but is not proof.
-- ---------------------------------------------------------------------
-- 003 / 032 / 033 / 034 / 037 / 038 / 039 add retailer sources:
--   select slug, name from market_platforms order by slug;
-- 045 / 046 widen the category map:
--   select category_slug, count(*) from market_category_map
--   group by category_slug order by category_slug;
-- 029 removed 18 stale OLX rows from market_category_map:
--   select count(*) from market_category_map mc
--   join market_platforms p on p.id = mc.platform_id where p.slug = 'olx';
--   -- expect 0 if 029 was applied
