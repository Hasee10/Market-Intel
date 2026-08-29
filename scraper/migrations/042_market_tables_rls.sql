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
-- Apply manually via the Supabase SQL Editor, after 001. Order relative to
-- 002-039 doesn't matter - this only adds policies, it doesn't touch any
-- table's columns or existing data.

alter table market_products enable row level security;
alter table market_price_history enable row level security;
alter table market_platforms enable row level security;
alter table market_categories enable row level security;
alter table market_product_matches enable row level security;
alter table market_product_reviews enable row level security;
alter table market_classified_listings enable row level security;
alter table market_classified_price_history enable row level security;

drop policy if exists market_products_select_anon on market_products;
create policy market_products_select_anon on market_products
  for select to anon, authenticated using (true);

drop policy if exists market_price_history_select_authenticated on market_price_history;
create policy market_price_history_select_authenticated on market_price_history
  for select to authenticated using (true);

drop policy if exists market_platforms_select_authenticated on market_platforms;
create policy market_platforms_select_authenticated on market_platforms
  for select to authenticated using (true);

drop policy if exists market_categories_select_authenticated on market_categories;
create policy market_categories_select_authenticated on market_categories
  for select to authenticated using (true);

drop policy if exists market_product_matches_select_authenticated on market_product_matches;
create policy market_product_matches_select_authenticated on market_product_matches
  for select to authenticated using (true);

drop policy if exists market_product_reviews_select_authenticated on market_product_reviews;
create policy market_product_reviews_select_authenticated on market_product_reviews
  for select to authenticated using (true);

drop policy if exists market_classified_listings_select_authenticated on market_classified_listings;
create policy market_classified_listings_select_authenticated on market_classified_listings
  for select to authenticated using (true);

drop policy if exists market_classified_price_history_select_authenticated on market_classified_price_history;
create policy market_classified_price_history_select_authenticated on market_classified_price_history
  for select to authenticated using (true);
