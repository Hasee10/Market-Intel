-- Phase 1 ("close the loops that already have schema"): watchlists, price
-- alerts, and a shared notification feed - all scoped to `sellers`, not the
-- legacy `market_accounts` table. market_watchlists/market_watchlist_items/
-- market_alerts_sent (001) were built against market_accounts (the dormant
-- buyer-side "market analyst" login from the original JobLo-era plan - see
-- new_implementation_doc.md's "open decisions"). This is a seller-centric
-- platform, so watchlists belong to sellers, not to that unresolved legacy
-- account type. Left market_watchlists/market_watchlist_items/
-- market_alerts_sent in place (unused) rather than dropping them, in case
-- market_accounts is resurrected later as a separate buyer-side product.
-- Apply manually against Supabase, same convention as 001-013.

create table if not exists seller_watchlists (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists seller_watchlists_seller_idx on seller_watchlists (seller_id);

create table if not exists seller_watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references seller_watchlists(id) on delete cascade,
  market_product_id uuid not null references market_products(id) on delete cascade,
  last_alerted_price numeric(12, 2),
  last_alerted_in_stock boolean,
  created_at timestamptz not null default now(),
  unique (watchlist_id, market_product_id)
);

create index if not exists seller_watchlist_items_product_idx
  on seller_watchlist_items (market_product_id);

-- Raw record of what changed for a watched product - written by the
-- price-alerts cron job (service role), read by sellers via RLS below.
-- last_alerted_price/last_alerted_in_stock on the item row (above) is what
-- the job diffs against, so a price that oscillates back to a previously
-- alerted value doesn't re-fire.
create table if not exists seller_price_alerts (
  id uuid primary key default gen_random_uuid(),
  watchlist_item_id uuid not null references seller_watchlist_items(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  reason text not null,
  old_price numeric(12, 2),
  new_price numeric(12, 2),
  old_in_stock boolean,
  new_in_stock boolean,
  created_at timestamptz not null default now()
);

create index if not exists seller_price_alerts_seller_idx
  on seller_price_alerts (seller_id, created_at desc);

-- Shared in-app notification feed - built once so price alerts, low-stock
-- (Phase 3), and churn-risk flags (Phase 3) all deliver through the same
-- table/UI instead of each growing its own bespoke read/unread tracking.
-- Email delivery is a later addition (see lib/notifications/notify.ts) -
-- this table only backs the in-app channel for now.
create table if not exists seller_notifications (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists seller_notifications_seller_idx
  on seller_notifications (seller_id, created_at desc);

alter table seller_watchlists enable row level security;
alter table seller_watchlist_items enable row level security;
alter table seller_price_alerts enable row level security;
alter table seller_notifications enable row level security;

create policy seller_watchlists_owner_all on seller_watchlists
  for all using (
    seller_id in (select id from sellers where user_id = auth.uid())
  ) with check (
    seller_id in (select id from sellers where user_id = auth.uid())
  );

-- seller_watchlist_items has no seller_id column directly - ownership is via
-- its parent watchlist.
create policy seller_watchlist_items_owner_all on seller_watchlist_items
  for all using (
    watchlist_id in (
      select id from seller_watchlists
      where seller_id in (select id from sellers where user_id = auth.uid())
    )
  ) with check (
    watchlist_id in (
      select id from seller_watchlists
      where seller_id in (select id from sellers where user_id = auth.uid())
    )
  );

-- seller_price_alerts: sellers can read their own alerts, but only the
-- service role (the cron job) writes rows - same pattern as
-- domain_benchmarks in 012.
create policy seller_price_alerts_select_own on seller_price_alerts
  for select using (
    seller_id in (select id from sellers where user_id = auth.uid())
  );

-- seller_notifications: sellers can read/update (mark read) their own rows;
-- only the service role inserts.
create policy seller_notifications_select_own on seller_notifications
  for select using (
    seller_id in (select id from sellers where user_id = auth.uid())
  );

create policy seller_notifications_update_own on seller_notifications
  for update using (
    seller_id in (select id from sellers where user_id = auth.uid())
  ) with check (
    seller_id in (select id from sellers where user_id = auth.uid())
  );
