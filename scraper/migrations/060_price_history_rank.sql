-- Position on the category page, recorded with every price observation.
--
-- "Historical chart → our product placement" on the product notes
-- (2026-09-18) needs where a listing SAT on the page over time, not only
-- what it cost. Nothing captured that. Every source already walks category
-- pages in order and hands the pipeline its products in that order, so the
-- rank is the product's 1-based position within its category in one run -
-- assigned in db.ts's saveProducts, with no change to any source module.
--
-- Additive and nullable. Every existing row stays null (history is
-- append-only; there is no way to know where a listing sat last month), and
-- rank starts being written on the first run after this is applied. The
-- (product_id, recorded_date) unique index from 026, the generated
-- recorded_date column, and the upsert path in db.ts are all untouched.
--
-- What rank means, precisely: the listing's position among the products
-- the source returned for that category in that run, first page first.
-- It is comparable within one platform+category across days. It is not
-- comparable across platforms (different page sizes, different sort
-- defaults), and the chart that reads it draws one line per platform for
-- that reason. A product that appears in two categories keeps the rank
-- from the first one seen, matching how saveProducts already dedupes by
-- external_id.
--
-- ORDER OF OPERATIONS: apply this BEFORE deploying the db.ts change that
-- writes the column. The insert names `rank` explicitly; against a table
-- without it, PostgREST rejects the whole batch and the scrape run fails.
-- The NOTIFY at the end makes the API layer pick the column up
-- immediately rather than on its own schedule - without it, the first run
-- after applying can still fail with "column rank not found in schema
-- cache" even though the column exists.
--
-- Apply manually via the Supabase SQL Editor.

alter table market_price_history
  add column if not exists rank integer;

comment on column market_price_history.rank is
  'Position of the listing on its category page in the run that recorded this row, 1-based, first page first. Null before migration 060 and for any source that cannot order. Comparable within one platform+category over time; not across platforms.';

-- Reload PostgREST's schema cache so the API accepts the column now.
notify pgrst, 'reload schema';
