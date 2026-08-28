-- Persists the per-product competitor matches shown in the Products page's
-- Competitors drawer (findCompetitorsForProduct(), price-bracket model
-- confirmed 2026-08-28). Previously fully ephemeral - recomputed fresh on
-- every drawer open with nothing written back - so there was no way to
-- track a specific competitor's price over time or notice it disappeared.
-- Same shape/intent as seller_watchlist_items (014), but that table is a
-- seller's manual search-and-add list; this one is written automatically
-- by the app whenever a seller views a product's competitors.
--
-- Decommission detection deliberately reuses market_products.is_active
-- rather than duplicating that state here - the scraper's
-- markStaleProducts() (scraper/src/db.ts) already flips it to false when a
-- listing drops out of a scrape run, so a persisted match just needs to be
-- joined against market_products and read is_active off it directly.
--
-- Rows are never deleted when a match falls out of the live top-5 (e.g. a
-- competitor's price drifts outside the +/-15% bracket) - last_confirmed_at
-- simply stops advancing. Keeping the row is what lets a stale/decommissioned
-- competitor's price history still be looked up later, instead of losing it
-- the moment it's no longer a top match.
--
-- Apply manually via the Supabase SQL Editor, after 027.

create table if not exists seller_product_competitor_matches (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  seller_product_id uuid not null references seller_products(id) on delete cascade,
  market_product_id uuid not null references market_products(id) on delete cascade,
  confidence numeric(4, 3) not null,
  first_matched_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  unique (seller_product_id, market_product_id)
);

create index if not exists seller_product_competitor_matches_seller_idx
  on seller_product_competitor_matches (seller_id);

create index if not exists seller_product_competitor_matches_product_idx
  on seller_product_competitor_matches (seller_product_id);

-- Drives price-history/decommission lookups the other way: given a
-- market_product_id, which sellers are tracking it as a competitor.
create index if not exists seller_product_competitor_matches_market_product_idx
  on seller_product_competitor_matches (market_product_id);

alter table seller_product_competitor_matches enable row level security;

drop policy if exists seller_product_competitor_matches_owner_all on seller_product_competitor_matches;
create policy seller_product_competitor_matches_owner_all on seller_product_competitor_matches
  for all using (
    seller_id in (select id from sellers where user_id = auth.uid())
  ) with check (
    seller_id in (select id from sellers where user_id = auth.uid())
  );
