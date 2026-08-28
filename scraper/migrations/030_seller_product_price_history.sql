-- Seller-side counterpart to market_price_history (001): that table tracks
-- competitor (market_products) price snapshots over time, but nothing
-- tracked a seller's own price history - only the current sell_price.
-- Flagged in memory.md (2026-08-28, "seller-vs-competitor price history has
-- a real gap") as the missing piece before a later-stage seller-vs-
-- competitor price comparison-over-time feature can be built. This
-- migration ships the infrastructure only (table + population); no UI or
-- comparison feature is built against it yet.
--
-- Apply manually via the Supabase SQL Editor, same convention as 001-029.

create table if not exists seller_product_price_history (
  id uuid primary key default gen_random_uuid(),
  seller_product_id uuid not null references seller_products(id) on delete cascade,
  -- Denormalized from seller_products.seller_id so the RLS policy below
  -- doesn't need a join, matching every other seller-scoped table in this
  -- project (e.g. seller_watchlists, seller_price_alerts).
  seller_id uuid not null references sellers(id) on delete cascade,
  sell_price numeric(12, 2),
  recorded_at timestamptz not null default now()
);

create index if not exists seller_product_price_history_product_recorded_idx
  on seller_product_price_history (seller_product_id, recorded_at desc);

-- Read-only for the seller - only the trigger below ever writes a row, same
-- pattern as seller_price_alerts_select_own (014): no insert/update/delete
-- policy for `authenticated` at all.
alter table seller_product_price_history enable row level security;

drop policy if exists seller_product_price_history_select_own on seller_product_price_history;
create policy seller_product_price_history_select_own on seller_product_price_history
  for select using (
    seller_id in (select id from sellers where user_id = auth.uid())
  );

-- Populated via trigger, not app-level insert calls, so every write path
-- (manual create/edit, and bulk-import's upsert() - which has no pre-image
-- to diff against at the application layer) is covered by one mechanism
-- instead of three separate call sites that could drift out of sync.
-- Records on insert (the starting price is itself a data point) and on any
-- update where sell_price actually changed - `is distinct from` correctly
-- treats a null-to-null "change" as a no-op, so editing unrelated fields
-- (title, stock_qty, ...) never writes a spurious history row.
create or replace function record_seller_product_price_history()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'INSERT') or (new.sell_price is distinct from old.sell_price) then
    insert into seller_product_price_history (seller_product_id, seller_id, sell_price)
    values (new.id, new.seller_id, new.sell_price);
  end if;
  return new;
end;
$$;

drop trigger if exists seller_products_price_history on seller_products;
create trigger seller_products_price_history
  after insert or update on seller_products
  for each row
  execute function record_seller_product_price_history();
