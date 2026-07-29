-- Combined migrations 001-010, to be pasted into the Supabase SQL Editor for
-- the NEW project (fognozenapenvmqsopxe - same one mantine-analytics-dashboard-dev
-- and migrations 011-013 already run against). These 10 files were originally
-- applied against the old job-portal Supabase project; the scraper has since
-- been repointed here (see scraper/.env) so it needs these tables to exist in
-- this project too. All statements are idempotent (create if not exists / add
-- column if not exists), so this is safe to run even if some objects already
-- partially exist. Delete this file once you've run it - it's just a
-- generated bundle of 001-010, not a new migration in its own right.

-- ===== 001_create_market_tables.sql =====
-- Market Intel tables. Separate namespace from job-portal tables (job_*, applications, etc).
-- Apply manually against Supabase, same convention as n8n-workflows/migrations/*.sql.

create table if not exists market_platforms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  base_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists market_categories (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references market_platforms(id) on delete cascade,
  slug text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (platform_id, slug)
);

create table if not exists market_products (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references market_platforms(id) on delete cascade,
  external_id text not null,
  category_slug text,
  title text not null,
  brand text,
  url text not null,
  image_url text,
  currency text not null default 'PKR',
  price numeric(12, 2),
  compare_at_price numeric(12, 2),
  in_stock boolean,
  rating numeric(3, 2),
  rating_count integer,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (platform_id, external_id)
);

create index if not exists market_products_platform_category_idx
  on market_products (platform_id, category_slug);

create table if not exists market_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references market_products(id) on delete cascade,
  price numeric(12, 2),
  compare_at_price numeric(12, 2),
  in_stock boolean,
  recorded_at timestamptz not null default now()
);

create index if not exists market_price_history_product_recorded_idx
  on market_price_history (product_id, recorded_at desc);

-- Placeholders for later phases (auth, watchlists, alerts). Created now so the
-- schema doesn't need a second migration when Phase 2/3 lands.
create table if not exists market_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null default 'market_analyst',
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists market_watchlists (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references market_accounts(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists market_watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references market_watchlists(id) on delete cascade,
  product_id uuid not null references market_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (watchlist_id, product_id)
);

create table if not exists market_alerts_sent (
  id uuid primary key default gen_random_uuid(),
  watchlist_item_id uuid not null references market_watchlist_items(id) on delete cascade,
  reason text not null,
  old_price numeric(12, 2),
  new_price numeric(12, 2),
  sent_at timestamptz not null default now()
);

-- Seed the two Phase 1 platforms.
insert into market_platforms (slug, name, base_url)
values
  ('priceoye', 'PriceOye.pk', 'https://priceoye.pk'),
  ('telemart', 'Telemart.pk', 'https://telemart.pk')
on conflict (slug) do nothing;

-- ===== 002_redesign_market_accounts.sql =====
-- market_accounts (created in 001) was a thin user_id/role placeholder with
-- no rows yet. Redesign it to be self-contained (own email + password_hash),
-- mirroring bordful-main's recruiter_accounts pattern, so the Phase 2
-- market_analyst credentials login has something real to authenticate against.

alter table market_accounts drop column if exists user_id;
alter table market_accounts drop column if exists role;

alter table market_accounts add column if not exists email text;
alter table market_accounts add column if not exists password_hash text;
alter table market_accounts add column if not exists company_name text;
alter table market_accounts add column if not exists plan_tier text not null default 'free';
alter table market_accounts add column if not exists updated_at timestamptz not null default now();

update market_accounts set email = '' where email is null;
update market_accounts set password_hash = '' where password_hash is null;
update market_accounts set company_name = '' where company_name is null;

alter table market_accounts alter column email set not null;
alter table market_accounts alter column password_hash set not null;
alter table market_accounts alter column company_name set not null;

create unique index if not exists market_accounts_email_idx on market_accounts (lower(email));

-- ===== 003_add_shophive_platform.sql =====
insert into market_platforms (slug, name, base_url)
values ('shophive', 'Shophive', 'https://www.shophive.com')
on conflict (slug) do nothing;

-- ===== 004_add_ishopping_platform.sql =====
insert into market_platforms (slug, name, base_url)
values ('ishopping', 'iShopping.pk', 'https://www.ishopping.pk')
on conflict (slug) do nothing;

-- ===== 005_add_goto_platform.sql =====
insert into market_platforms (slug, name, base_url)
values ('goto', 'Goto.com.pk', 'https://www.goto.com.pk')
on conflict (slug) do nothing;

-- ===== 006_add_sapphireonline_platform.sql =====
insert into market_platforms (slug, name, base_url)
values ('sapphireonline', 'Sapphire Online', 'https://pk.sapphireonline.pk')
on conflict (slug) do nothing;

-- ===== 007_create_olx_classifieds_tables.sql =====
-- OLX Pakistan is peer-to-peer classifieds, not a fixed-seller marketplace -
-- listings are one-off asking prices tied to condition/location, not a
-- stable product being repriced over time. Doesn't fit market_products'
-- unique(platform_id, external_id) + price-history model, so it gets its
-- own pair of tables mirroring that pattern instead.

create table if not exists market_classified_listings (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references market_platforms(id) on delete cascade,
  external_id text not null,
  category_slug text,
  title text not null,
  url text not null,
  image_url text,
  currency text not null default 'PKR',
  price numeric(12, 2),
  condition text,
  city text,
  seller_type text,
  posted_at timestamptz,
  status text not null default 'active',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (platform_id, external_id)
);

create index if not exists market_classified_listings_platform_category_idx
  on market_classified_listings (platform_id, category_slug);

create table if not exists market_classified_price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references market_classified_listings(id) on delete cascade,
  price numeric(12, 2),
  status text not null,
  recorded_at timestamptz not null default now()
);

create index if not exists market_classified_price_history_listing_recorded_idx
  on market_classified_price_history (listing_id, recorded_at desc);

insert into market_platforms (slug, name, base_url)
values ('olx', 'OLX Pakistan', 'https://www.olx.com.pk')
on conflict (slug) do nothing;

-- ===== 008_track_stale_products.sql =====
alter table market_products add column if not exists is_active boolean not null default true;

create index if not exists market_products_platform_active_idx
  on market_products (platform_id, is_active);

create index if not exists market_classified_listings_platform_status_idx
  on market_classified_listings (platform_id, status);

-- ===== 009_product_matches.sql =====
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

-- ===== 010_gallery_urls.sql =====
alter table market_products add column if not exists gallery_urls text[];

-- ===== 014_seller_watchlists_and_notifications.sql =====
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
