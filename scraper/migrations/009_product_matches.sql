-- Cross-platform "same product, different seller" matches, used to power a
-- "Also available on" comparison on the market-intel product detail page.
-- Scoped to mobiles only for v1 - laptop titles produce false positives with
-- the current title/spec-code heuristic (e.g. HP reuses the same CPU code
-- across different ProBook model lines), see match-products.ts for the
-- scoring logic and its documented limits. Apply manually, same convention
-- as 001-008.

create table if not exists market_product_matches (
  id uuid primary key default gen_random_uuid(),
  product_a_id uuid not null references market_products(id) on delete cascade,
  product_b_id uuid not null references market_products(id) on delete cascade,
  confidence numeric(4, 3) not null,
  created_at timestamptz not null default now(),
  unique (product_a_id, product_b_id)
);

create index if not exists market_product_matches_a_idx on market_product_matches (product_a_id);
create index if not exists market_product_matches_b_idx on market_product_matches (product_b_id);
