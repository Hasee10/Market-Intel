-- OLX Pakistan is peer-to-peer classifieds, not a fixed-seller marketplace -
-- listings are one-off asking prices tied to condition/location, not a
-- stable product being repriced over time. Doesn't fit market_products'
-- unique(platform_id, external_id) + price-history model, so it gets its
-- own pair of tables mirroring that pattern instead.
-- Apply manually against Supabase, same convention as 001-006.

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
