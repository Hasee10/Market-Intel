-- Adds Daraz.pk as a tracked platform, plus the seller-identity and
-- demand-proxy columns its listings carry (ROADMAP.md D1).
-- Apply manually against Supabase, same convention as 001-018.

insert into market_platforms (slug, name, base_url)
values ('daraz', 'Daraz', 'https://www.daraz.pk')
on conflict (slug) do nothing;

-- Seller identity behind a listing. Every source so far has been either a
-- single retailer (where the platform *is* the seller) or a classifieds site,
-- so market_products has had no notion of who is selling. Daraz is a true
-- marketplace and names the merchant, which is the prerequisite for the
-- competitor entity in ROADMAP.md C1. Nullable, because it stays null for
-- every single-retailer source.
alter table market_products
  add column if not exists seller_name text,
  add column if not exists seller_external_id text;

-- Platform-reported units sold. Coarse and rounded by Daraz itself ("6 sold",
-- "1.2K sold"), so it is a demand *proxy* - the closest thing we have to a
-- demand signal, since everything else we scrape is supply. Anything built on
-- this must label it as a proxy (ROADMAP.md gap #3); it is not sales data.
alter table market_products
  add column if not exists sold_count integer;

-- Supports the per-competitor rollups C1 will need: "every listing by seller
-- X", scoped to a platform.
create index if not exists market_products_platform_seller_idx
  on market_products (platform_id, seller_external_id)
  where seller_external_id is not null;
