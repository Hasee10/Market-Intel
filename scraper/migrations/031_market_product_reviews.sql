-- Review text for scraped competitor products. rating/rating_count on
-- market_products already give an aggregate signal (Daraz/PriceOye only);
-- this adds the actual review text behind that aggregate, for products a
-- separate review-scraper job has visited.
--
-- Scoped to PriceOye only for now (see scraper/src/reviews/) - verified live
-- that PriceOye product pages embed a full JSON-LD `review` array, fetchable
-- with a plain HTTP request. Daraz's reviews load via a signed internal API
-- (Alibaba/Lazada Mtop gateway) that a static fetch can't reach - needs a
-- real browser render to verify/implement, not guessed blind. Other sources
-- (Shopify/WooCommerce-based) have no reviews field in their structured
-- endpoints at all - would need a per-site check for a third-party reviews
-- app, not attempted here. The schema itself is platform-agnostic so adding
-- a source later is additive, no migration change needed.
--
-- Apply manually via the Supabase SQL Editor, same convention as 001-030.

create table if not exists market_product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references market_products(id) on delete cascade,
  author text,
  rating numeric(3, 2),
  review_text text not null,
  reviewed_at timestamptz,
  scraped_at timestamptz not null default now(),
  -- Crude but sufficient re-scrape dedupe: same product + same author + same
  -- text is treated as the same review. A different edited/re-submitted
  -- review with identical text from the same author would be missed as a
  -- new row, which is an acceptable MVP tradeoff, not a system this size
  -- needs a real external review-id for.
  unique (product_id, author, review_text)
);

create index if not exists market_product_reviews_product_idx
  on market_product_reviews (product_id);

-- Batch-selection cooldown: null = never scraped, otherwise skip until this
-- many days have passed. See scraper/src/reviews/run.ts.
alter table market_products add column if not exists reviews_scraped_at timestamptz;

-- No RLS - same as market_products/market_price_history: shared competitor
-- data, not seller-private.
