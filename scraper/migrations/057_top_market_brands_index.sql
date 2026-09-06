-- Fixes top_market_brands() (024) timing out in production.
--
-- Confirmed in a Vercel build log (2026-09-06):
--   [showcase] brand lookup failed, serving last known good
--   Error: top_market_brands: canceling statement due to statement timeout
--
-- The function does `select brand, count(*) from market_products where
-- is_active and brand is not null and btrim(brand) <> '' group by brand`
-- with nothing but the table's default heap layout to scan - a full
-- sequential scan reading every column of every row just to count them, and
-- the catalogue has grown past whatever Postgres' statement_timeout is with
-- that plan.
--
-- A partial index on exactly the predicate this query filters on lets
-- Postgres answer with an index-only scan instead: count(*) needs nothing
-- but the index entry's existence, so with brand indexed the heap is never
-- touched at all for rows that qualify. `is_active` first in the index
-- narrows the scan before brand ever has to be compared, same ordering
-- reasoning as every other partial index in this schema.
--
-- Since the homepage's company slider caches this for an hour
-- (showcase.ts's unstable_cache) and only ever needs the top 10-12 brands,
-- this index only has to make the underlying scan cheap, not the whole
-- query free - it does that.
--
-- Apply manually via the Supabase SQL Editor.

create index if not exists idx_market_products_brand_active
  on market_products (is_active, brand)
  where is_active = true and brand is not null;
