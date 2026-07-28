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
