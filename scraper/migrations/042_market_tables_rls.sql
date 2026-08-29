-- Fixes a real gap found in a code audit of every migration 001-039
-- (2026-08-29): eight tables were created and never had RLS enabled at all.
--
-- Cross-checked mechanically (every `create table` against every
-- `enable row level security` across all migration files) - these eight
-- came back with no RLS anywhere:
--
--   market_products, market_price_history, market_platforms,
--   market_categories, market_product_matches, market_product_reviews,
--   market_classified_listings, market_classified_price_history
--
-- Newer market tables (market_competitors, market_category_map) already got
-- RLS when they were created - this is retrofitting the same discipline to
-- the original 001-era tables, not introducing a new pattern. Under
-- Supabase's default grants, a public-schema table with no RLS is readable
-- (and writable) by anyone holding the anon key, which ships to the browser
-- in this app (NEXT_PUBLIC_SUPABASE_ANON_KEY) - that is the entire scraped
-- dataset every price/median/recommendation is built from.
--
-- (market_accounts/market_watchlists/market_watchlist_items/
-- market_alerts_sent - the other tables created in 001 without RLS - are
-- NOT included here: they were dropped in 015_phase5_6.sql and no longer
-- exist. Nothing to protect.)
--
-- These eight are all read-only from the app's perspective - the scraper
-- writes with the service-role key, which bypasses RLS entirely, so no
-- write policy is added or needed. A select policy is enough to close the
-- gap without changing how anything currently works.
--
-- market_products gets an additional `anon` grant specifically because
-- top_market_brands() (024) is `security invoker` and is called from the
-- public marketing homepage via the anon client (showcase.ts,
-- CompanyLogoSlider) - without this grant, enabling RLS here would silently
-- break that RPC for every logged-out visitor. None of the other seven
-- tables are read by anon anywhere in the app, so they stay
-- authenticated-only, matching seller_categories' existing precedent
-- (012_enable_seller_rls_policies.sql).
--
-- Each block below is guarded by a to_regclass() existence check and RAISEs
-- a NOTICE rather than erroring when a table isn't there yet - added after
-- a live run hit `relation "market_product_reviews" does not exist`
-- (031_market_product_reviews.sql had never been applied on that project).
-- Migrations here are not guaranteed applied in strict order in practice
-- (see mind.md's repeated warning on this), so this migration must not
-- assume every one of the eight tables it's protecting already exists -
-- better to protect the seven that do and say plainly which one it
-- skipped, than to abort the whole script on the first missing table and
-- leave the other seven still unprotected. Safe to re-run once the missing
-- table's own migration is applied - it will pick up whatever it skipped
-- last time.
--
-- Apply manually via the Supabase SQL Editor, after 001. Order relative to
-- 002-039 doesn't matter for tables that exist - this only adds policies,
-- it doesn't touch any table's columns or existing data.

do $$
begin
  if to_regclass('public.market_products') is not null then
    execute 'alter table market_products enable row level security';
    execute 'drop policy if exists market_products_select_anon on market_products';
    execute 'create policy market_products_select_anon on market_products for select to anon, authenticated using (true)';
  else
    raise notice 'Skipped market_products - table does not exist yet.';
  end if;
end $$;

do $$
begin
  if to_regclass('public.market_price_history') is not null then
    execute 'alter table market_price_history enable row level security';
    execute 'drop policy if exists market_price_history_select_authenticated on market_price_history';
    execute 'create policy market_price_history_select_authenticated on market_price_history for select to authenticated using (true)';
  else
    raise notice 'Skipped market_price_history - table does not exist yet.';
  end if;
end $$;

do $$
begin
  if to_regclass('public.market_platforms') is not null then
    execute 'alter table market_platforms enable row level security';
    execute 'drop policy if exists market_platforms_select_authenticated on market_platforms';
    execute 'create policy market_platforms_select_authenticated on market_platforms for select to authenticated using (true)';
  else
    raise notice 'Skipped market_platforms - table does not exist yet.';
  end if;
end $$;

do $$
begin
  if to_regclass('public.market_categories') is not null then
    execute 'alter table market_categories enable row level security';
    execute 'drop policy if exists market_categories_select_authenticated on market_categories';
    execute 'create policy market_categories_select_authenticated on market_categories for select to authenticated using (true)';
  else
    raise notice 'Skipped market_categories - table does not exist yet.';
  end if;
end $$;

do $$
begin
  if to_regclass('public.market_product_matches') is not null then
    execute 'alter table market_product_matches enable row level security';
    execute 'drop policy if exists market_product_matches_select_authenticated on market_product_matches';
    execute 'create policy market_product_matches_select_authenticated on market_product_matches for select to authenticated using (true)';
  else
    raise notice 'Skipped market_product_matches - table does not exist yet.';
  end if;
end $$;

do $$
begin
  if to_regclass('public.market_product_reviews') is not null then
    execute 'alter table market_product_reviews enable row level security';
    execute 'drop policy if exists market_product_reviews_select_authenticated on market_product_reviews';
    execute 'create policy market_product_reviews_select_authenticated on market_product_reviews for select to authenticated using (true)';
  else
    raise notice 'Skipped market_product_reviews - table does not exist yet (031_market_product_reviews.sql not applied).';
  end if;
end $$;

do $$
begin
  if to_regclass('public.market_classified_listings') is not null then
    execute 'alter table market_classified_listings enable row level security';
    execute 'drop policy if exists market_classified_listings_select_authenticated on market_classified_listings';
    execute 'create policy market_classified_listings_select_authenticated on market_classified_listings for select to authenticated using (true)';
  else
    raise notice 'Skipped market_classified_listings - table does not exist yet.';
  end if;
end $$;

do $$
begin
  if to_regclass('public.market_classified_price_history') is not null then
    execute 'alter table market_classified_price_history enable row level security';
    execute 'drop policy if exists market_classified_price_history_select_authenticated on market_classified_price_history';
    execute 'create policy market_classified_price_history_select_authenticated on market_classified_price_history for select to authenticated using (true)';
  else
    raise notice 'Skipped market_classified_price_history - table does not exist yet.';
  end if;
end $$;
