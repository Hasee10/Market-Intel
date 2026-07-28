-- Seller-centric platform schema. Separate tenant model from market_accounts
-- (which is legacy bcrypt-based auth for the old JobLo-integrated product,
-- untouched here). This platform authenticates via Supabase Auth: every
-- seller row maps 1:1 to an auth.users row via user_id.
--
-- Two-tier data model, this is the core privacy boundary of the product:
--   - PRIVATE tables (seller_products, seller_orders, seller_customers,
--     seller_churn_snapshots): visible only to the owning seller. Never
--     exposed to other sellers in raw form.
--   - PEER-VISIBLE (domain_benchmarks): anonymized, aggregated stats per
--     category, computed by a backend job from private data with a minimum
--     sample-size threshold so no single competitor's numbers can be
--     reverse-engineered from a small cohort. Written only by the service
--     role (see 012_enable_seller_rls_policies.sql).
--   - OPT-IN PUBLIC (seller_public_profile): a seller may explicitly choose
--     to let peers see specific fields about them by name. Off by default.
--
-- market_products / market_price_history (001) remain the competitor layer,
-- sourced from public marketplace listings via the scraper - already
-- peer-visible by nature since the data was never private to begin with.
-- Apply manually against Supabase, same convention as 001-010.

create table if not exists seller_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

insert into seller_categories (slug, name) values
  ('mobiles-and-electronics', 'Mobiles & Electronics'),
  ('fashion-and-apparel', 'Fashion & Apparel'),
  ('beauty-and-personal-care', 'Beauty & Personal Care'),
  ('coffee-and-beverages', 'Coffee & Beverages'),
  ('grocery-and-food', 'Grocery & Food'),
  ('home-and-kitchen', 'Home & Kitchen'),
  ('books-and-stationery', 'Books & Stationery'),
  ('toys-and-baby', 'Toys & Baby'),
  ('sports-and-outdoors', 'Sports & Outdoors'),
  ('automotive', 'Automotive'),
  ('health-and-wellness', 'Health & Wellness'),
  ('other', 'Other')
on conflict (slug) do nothing;

create table if not exists sellers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  email text not null,
  plan_tier text not null default 'free',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists seller_domains (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  category_id uuid not null references seller_categories(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (seller_id, category_id)
);

create index if not exists seller_domains_category_idx on seller_domains (category_id);

-- PRIVATE: seller's own catalog (distinct from market_products, which is
-- scraped competitor data).
create table if not exists seller_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  sku text,
  title text not null,
  category_id uuid references seller_categories(id),
  cost_price numeric(12, 2),
  sell_price numeric(12, 2),
  stock_qty integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists seller_products_seller_sku_idx
  on seller_products (seller_id, sku) where sku is not null;
create index if not exists seller_products_seller_active_idx
  on seller_products (seller_id, is_active);

-- PRIVATE: raw customer records, imported via CSV/manual entry/future API
-- connectors. Never exposed to other sellers.
create table if not exists seller_customers (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  external_customer_id text,
  email text,
  first_order_at timestamptz,
  last_order_at timestamptz,
  orders_count integer not null default 0,
  total_spent numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, external_customer_id)
);

create index if not exists seller_customers_seller_last_order_idx
  on seller_customers (seller_id, last_order_at desc);

-- PRIVATE: raw order records.
create table if not exists seller_orders (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  customer_id uuid references seller_customers(id) on delete set null,
  external_order_id text,
  order_date timestamptz not null,
  total_amount numeric(12, 2) not null,
  currency text not null default 'PKR',
  status text,
  created_at timestamptz not null default now(),
  unique (seller_id, external_order_id)
);

create index if not exists seller_orders_seller_date_idx
  on seller_orders (seller_id, order_date desc);
create index if not exists seller_orders_customer_idx
  on seller_orders (customer_id);

-- PRIVATE: precomputed churn/retention snapshots so the dashboard doesn't
-- recompute RFM/cohort math on every page load. Refreshed by a backend job.
create table if not exists seller_churn_snapshots (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  snapshot_date date not null,
  churn_rate numeric(5, 2),
  retention_rate numeric(5, 2),
  repeat_purchase_rate numeric(5, 2),
  avg_clv numeric(12, 2),
  new_customers integer,
  returning_customers integer,
  computed_at timestamptz not null default now(),
  unique (seller_id, snapshot_date)
);

create index if not exists seller_churn_snapshots_seller_date_idx
  on seller_churn_snapshots (seller_id, snapshot_date desc);

-- OPT-IN PUBLIC: a seller explicitly chooses which fields, if any, peers can
-- see attached to their name. Off (is_public = false) by default. Only the
-- fields listed here can ever be peer-visible by name - everything else in
-- the private tables above stays private no matter what.
create table if not exists seller_public_profile (
  seller_id uuid primary key references sellers(id) on delete cascade,
  is_public boolean not null default false,
  display_name text,
  show_price_position boolean not null default false,
  show_rating boolean not null default false,
  show_category_rank boolean not null default false,
  updated_at timestamptz not null default now()
);

-- PEER-VISIBLE: anonymized aggregate benchmarks per category/metric. Only
-- the aggregation job (service role) writes here - see 012 for the RLS that
-- enforces this. sample_size lets the UI (or the job itself) suppress a
-- benchmark when too few sellers contribute to it to stay anonymous.
create table if not exists domain_benchmarks (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references seller_categories(id) on delete cascade,
  metric_name text not null,
  p25 numeric(14, 4),
  median numeric(14, 4),
  p75 numeric(14, 4),
  sample_size integer not null,
  computed_at timestamptz not null default now(),
  unique (category_id, metric_name)
);

create index if not exists domain_benchmarks_category_idx on domain_benchmarks (category_id);
