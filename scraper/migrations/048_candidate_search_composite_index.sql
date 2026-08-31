-- Composite index for candidate search. Pairs with migration 047 - apply both
-- or neither (047's header has the benchmark showing why 047 alone loses).
--
-- 036 added `market_products_title_trgm_idx` on (title gin_trgm_ops) where
-- is_active. That index knows nothing about category_slug or platform_id, so
-- market_top_similar_candidates has to fetch every title in the WHOLE table
-- similar enough to the query, then throw away the ones outside the seller's
-- scope. On a 60,000-row test table across 12 categories the plan showed
-- 16,103 rows coming back from the index and 13,959 of them discarded by the
-- recheck/filter - roughly seven rows read for every one kept, and it gets
-- worse as more sources are added, since a seller's scope stays the same size
-- while the table around it grows.
--
-- Putting category_slug and platform_id in the index (via btree_gin, which
-- lets plain scalar columns share a GIN index with a trigram column) lets
-- Postgres apply the scope filter during the index scan instead of after it.
-- Measured effect on resolving 20 titles, same data, pgbench:
--
--   20 concurrent single calls ....... 590 ms -> 380 ms
--   4 concurrent 5-title batches ..... 703 ms -> 341 ms
--
-- Confirmed the planner actually switches to it: after a stats reset, this
-- index took 120 scans and market_products_title_trgm_idx took 0.
--
-- Cost of carrying it, both measured on the same 60k table:
--   * Size: ~3.3 MB, against ~7.8 MB for the existing title-only trigram
--     index - it is smaller, not larger, because the scope columns make
--     posting lists shorter.
--   * Writes: a 20,000-row insert went 1,476ms -> 2,402ms. The scraper writes
--     ~55,000 rows every two days inside a job that already runs 24-64
--     minutes, so this adds roughly 2.5 seconds to it. Not a concern.
--
-- 036's index is deliberately NOT dropped here. findCompetitorsForProduct
-- still calls the single-title function, and dropping an index in the same
-- migration that adds its replacement leaves no cheap way back if the planner
-- behaves differently on production data than on the benchmark table. Drop it
-- in a later migration once pg_stat_user_indexes on production confirms
-- idx_scan has stopped climbing for it.
--
-- Apply manually via the Supabase SQL Editor, same convention as every prior
-- migration.

-- Ships with Supabase. Lets scalar columns (category_slug, platform_id) live
-- in the same GIN index as the trigram-indexed title.
create extension if not exists btree_gin;

create index if not exists market_products_cat_plat_title_trgm_idx
  on market_products using gin (category_slug, platform_id, title gin_trgm_ops)
  where is_active;
