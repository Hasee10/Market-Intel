-- ROADMAP.md A3 (the model) + C2 (the surface it powers).
--
-- Replaces CATEGORY_KEYWORDS in src/lib/market-intel/category-keywords.ts: a
-- hardcoded Record<string, RegExp> that matched a seller's category against the
-- raw scraped `category_slug` by substring. That was gap #1 in ROADMAP.md, and
-- a live read of this database on 2026-08-03 showed exactly how badly it fails.
-- The single regex for `mobiles-and-electronics` matches all of these:
--
--   ishopping   / laptops                    911 rows   median  139,296
--   shophive    / laptops-computers/laptops  291 rows   median  364,499
--   ishopping   / mobiles                   1035 rows   median   21,249
--   shophive    / mobile-phones              495 rows   median    5,199
--   priceoye    / power-banks                 37 rows   median    3,599
--
-- so a power-bank seller is handed a "category median" computed against
-- ~364k laptops. Every percentile, price index, recommendation and report
-- number inherits that. It is not a missing feature; it silently corrupts
-- output that already ships.
--
-- Two tables:
--
--   market_category_map      - the taxonomy. Which scraped (platform,
--                              category_slug) pairs belong to which seller
--                              category, each tagged with a *segment* so
--                              laptops and power banks are separable. Shared
--                              reference data, service-role writable only.
--   seller_market_definitions - the seller's own scope over that taxonomy:
--                              which segments, which price band, which
--                              brands, cities and platforms are in play.
--                              Owner-only, RLS on auth.uid().
--
-- Apply manually via the Supabase SQL Editor, same convention as 001-019.
-- Requires 019 to have run first (the daraz rows below reference it).

-- ---------------------------------------------------------------------------
-- 1. The taxonomy
-- ---------------------------------------------------------------------------

create table if not exists market_category_map (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references market_platforms(id) on delete cascade,
  -- Matches market_products.category_slug / market_classified_listings.category_slug
  -- exactly. Deliberately an exact string, not a pattern: if a scraper starts
  -- emitting a new slug we want it to show up as unmapped and get a decision,
  -- not to be silently swallowed by a greedy regex.
  category_slug text not null,
  seller_category_slug text not null references seller_categories(slug) on delete cascade,
  -- The dimension the regex had no way to express. Two scraped nodes can share
  -- a seller category and still be different markets ("laptops" vs
  -- "accessories"); the seller picks which segments they actually compete in.
  segment_slug text not null,
  segment_label text not null,
  created_at timestamptz not null default now(),
  -- A scraped node may legitimately map to more than one seller category
  -- (OLX `gym-fitness_c771` is both sports and health), so the uniqueness is
  -- on the triple, not on the pair.
  unique (platform_id, category_slug, seller_category_slug)
);

create index if not exists market_category_map_seller_category_idx
  on market_category_map (seller_category_slug);
create index if not exists market_category_map_lookup_idx
  on market_category_map (platform_id, category_slug);

alter table market_category_map enable row level security;

-- Reference data: any authenticated seller may read it (the market-definition
-- editor needs to render the full segment list, including segments they have
-- excluded). Writes are service-role only - there is deliberately no insert or
-- update policy for `authenticated`.
drop policy if exists market_category_map_select_all on market_category_map;
create policy market_category_map_select_all on market_category_map
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2. The seller's scope over it
-- ---------------------------------------------------------------------------

create table if not exists seller_market_definitions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  seller_category_slug text not null references seller_categories(slug) on delete cascade,

  -- Empty array means "every segment mapped to this category" rather than
  -- "no segments". That keeps the zero-config default identical to today's
  -- behaviour, so a seller who never opens the editor sees no regression -
  -- they just stop being compared against a market nobody defined.
  included_segments text[] not null default '{}',

  -- Explicit opt-*out*, so a newly added platform widens every existing
  -- seller's market automatically instead of being invisible until they
  -- re-save their definition.
  excluded_platform_ids uuid[] not null default '{}',

  -- Null means unbounded. Stored in the seller's reporting currency at the
  -- time of editing; the resolver converts scraped rows into that currency
  -- before comparing, the same way getCategoryPricing already does.
  price_min numeric(12, 2),
  price_max numeric(12, 2),
  price_currency text not null default 'PKR',

  -- Empty means "all". Brands match market_products.brand case-insensitively;
  -- cities match market_classified_listings.city and are inert for the
  -- retailer sources, which have no geography.
  brands text[] not null default '{}',
  cities text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One definition per category per seller. A seller selling in two
  -- categories gets two definitions, which is correct - they are two markets.
  unique (seller_id, seller_category_slug),

  constraint seller_market_definitions_price_band_ordered
    check (price_min is null or price_max is null or price_min <= price_max),
  constraint seller_market_definitions_price_min_nonneg
    check (price_min is null or price_min >= 0)
);

create index if not exists seller_market_definitions_seller_idx
  on seller_market_definitions (seller_id);

alter table seller_market_definitions enable row level security;

-- Same owner-only pattern as every other private seller table in 012.
drop policy if exists seller_market_definitions_owner_all on seller_market_definitions;
create policy seller_market_definitions_owner_all on seller_market_definitions
  for all using (
    seller_id in (select id from sellers where user_id = auth.uid())
  ) with check (
    seller_id in (select id from sellers where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Seed the taxonomy
-- ---------------------------------------------------------------------------
--
-- Every row below is either a (platform, category_slug) pair observed live in
-- this database on 2026-08-03, or a slug the scraper is configured to fetch
-- (OLX_CATEGORIES / DARAZ_CATEGORIES in .github/workflows/market-scraper.yml)
-- and will emit on its next successful run. Nothing here is guessed.
--
-- The OLX rows currently match zero data: market_classified_listings is empty
-- because that source has been failing silently (see ROADMAP.md D4). They are
-- seeded anyway so that coverage for the 10 categories OLX alone serves comes
-- back the moment the source does, with no second migration.

insert into market_category_map (platform_id, category_slug, seller_category_slug, segment_slug, segment_label)
select p.id, v.category_slug, v.seller_category_slug, v.segment_slug, v.segment_label
from (values
  -- === Observed live in market_products =================================
  ('ishopping',      'mobiles',                   'mobiles-and-electronics', 'phones',      'Phones'),
  ('ishopping',      'laptops',                   'mobiles-and-electronics', 'laptops',     'Laptops & Computing'),
  ('shophive',       'mobile-phones',             'mobiles-and-electronics', 'phones',      'Phones'),
  ('shophive',       'apple/iphone',              'mobiles-and-electronics', 'phones',      'Phones'),
  ('shophive',       'laptops-computers/laptops', 'mobiles-and-electronics', 'laptops',     'Laptops & Computing'),
  ('shophive',       'tablets',                   'mobiles-and-electronics', 'tablets',     'Tablets'),
  ('telemart',       'mobiles-tablets',           'mobiles-and-electronics', 'phones',      'Phones'),
  ('priceoye',       'mobiles',                   'mobiles-and-electronics', 'phones',      'Phones'),
  ('priceoye',       'laptops',                   'mobiles-and-electronics', 'laptops',     'Laptops & Computing'),
  ('priceoye',       'tablets',                   'mobiles-and-electronics', 'tablets',     'Tablets'),
  ('priceoye',       'smart-watches',             'mobiles-and-electronics', 'wearables',   'Wearables'),
  ('priceoye',       'wireless-earbuds',          'mobiles-and-electronics', 'audio',       'Audio'),
  ('priceoye',       'bluetooth-speakers',        'mobiles-and-electronics', 'audio',       'Audio'),
  ('priceoye',       'power-banks',               'mobiles-and-electronics', 'accessories', 'Accessories'),
  ('goto',           'computing-gaming',          'mobiles-and-electronics', 'laptops',     'Laptops & Computing'),
  ('telemart',       'mens-fashion',              'fashion-and-apparel',     'menswear',    'Menswear'),
  ('goto',           'mens-fashion',              'fashion-and-apparel',     'menswear',    'Menswear'),
  ('goto',           'womens-fashion',            'fashion-and-apparel',     'womenswear',  'Womenswear'),
  ('sapphireonline', 'ready-to-wear',             'fashion-and-apparel',     'womenswear',  'Womenswear'),
  ('sapphireonline', 'unstitched',                'fashion-and-apparel',     'unstitched',  'Unstitched Fabric'),

  -- === Configured on Daraz (DARAZ_CATEGORIES), pending first run ==========
  ('daraz', 'smartphones',        'mobiles-and-electronics', 'phones',      'Phones'),
  ('daraz', 'phones-tablets',     'mobiles-and-electronics', 'phones',      'Phones'),
  ('daraz', 'laptops',            'mobiles-and-electronics', 'laptops',     'Laptops & Computing'),
  ('daraz', 'laptop-accessories', 'mobiles-and-electronics', 'accessories', 'Accessories'),
  ('daraz', 'audio',              'mobiles-and-electronics', 'audio',       'Audio'),
  ('daraz', 'televisions',        'mobiles-and-electronics', 'tv',          'TV & Home Entertainment'),
  ('daraz', 'mens-fashion',       'fashion-and-apparel',     'menswear',    'Menswear'),
  ('daraz', 'womens-fashion',     'fashion-and-apparel',     'womenswear',  'Womenswear'),
  ('daraz', 'mens-shoes',         'fashion-and-apparel',     'footwear',    'Footwear'),
  ('daraz', 'womens-shoes',       'fashion-and-apparel',     'footwear',    'Footwear'),
  ('daraz', 'jewellery',          'fashion-and-apparel',     'accessories', 'Fashion Accessories'),
  ('daraz', 'sunglasses',         'fashion-and-apparel',     'accessories', 'Fashion Accessories'),
  ('daraz', 'beauty-health',      'beauty-and-personal-care','beauty',      'Beauty & Cosmetics'),
  ('daraz', 'beauty-health',      'health-and-wellness',     'health',      'Health & Supplements'),
  ('daraz', 'home-appliances',    'home-and-kitchen',        'appliances',  'Home Appliances'),
  ('daraz', 'kitchen-dining',     'home-and-kitchen',        'kitchen',     'Kitchen & Dining'),
  ('daraz', 'furniture-decor',    'home-and-kitchen',        'furniture',   'Furniture & Decor'),
  ('daraz', 'stationery-craft',   'books-and-stationery',    'stationery',  'Stationery & Craft'),
  ('daraz', 'books-magazines',    'books-and-stationery',    'books',       'Books'),
  ('daraz', 'toys-games',         'toys-and-baby',           'toys',        'Toys & Games'),
  ('daraz', 'mother-baby',        'toys-and-baby',           'baby',        'Baby & Nursery'),
  ('daraz', 'exercise-fitness',   'sports-and-outdoors',     'fitness',     'Fitness Equipment'),
  ('daraz', 'exercise-fitness',   'health-and-wellness',     'fitness',     'Fitness Equipment'),
  ('daraz', 'automotive',         'automotive',              'parts',       'Parts & Accessories'),

  -- === Configured on OLX (OLX_CATEGORIES), source currently failing =======
  ('olx', 'mobile-phones_c1453',      'mobiles-and-electronics',  'phones',     'Phones'),
  ('olx', 'laptops-computers_c1470',  'mobiles-and-electronics',  'laptops',    'Laptops & Computing'),
  ('olx', 'tablets_c1455',            'mobiles-and-electronics',  'tablets',    'Tablets'),
  ('olx', 'smart-watches_c1458',      'mobiles-and-electronics',  'wearables',  'Wearables'),
  ('olx', 'fashion-beauty_c87',       'fashion-and-apparel',      'mixed',      'General Fashion'),
  ('olx', 'fashion-beauty_c87',       'beauty-and-personal-care', 'beauty',     'Beauty & Cosmetics'),
  ('olx', 'skin-hair_c1972',          'beauty-and-personal-care', 'skin-hair',  'Skin & Hair Care'),
  ('olx', 'farm-fresh-food_c2005',    'grocery-and-food',         'fresh',      'Fresh & Packaged Food'),
  ('olx', 'farm-fresh-food_c2005',    'coffee-and-beverages',     'beverages',  'Beverages'),
  ('olx', 'furniture-home-decor_c628','home-and-kitchen',         'furniture',  'Furniture & Decor'),
  ('olx', 'kitchen-appliances_c1930', 'home-and-kitchen',         'appliances', 'Home Appliances'),
  ('olx', 'books-magazines_c453',     'books-and-stationery',     'books',      'Books'),
  ('olx', 'toys_c1977',               'toys-and-baby',            'toys',       'Toys & Games'),
  ('olx', 'baby-gear_c707086',        'toys-and-baby',            'baby',       'Baby & Nursery'),
  ('olx', 'sports-equipment_c100',    'sports-and-outdoors',      'equipment',  'Sports Equipment'),
  ('olx', 'gym-fitness_c771',         'sports-and-outdoors',      'fitness',    'Fitness Equipment'),
  ('olx', 'gym-fitness_c771',         'health-and-wellness',      'fitness',    'Fitness Equipment'),
  ('olx', 'spare-parts_c82',          'automotive',               'parts',      'Parts & Accessories')
) as v(platform_slug, category_slug, seller_category_slug, segment_slug, segment_label)
join market_platforms p on p.slug = v.platform_slug
on conflict (platform_id, category_slug, seller_category_slug) do update
  set segment_slug = excluded.segment_slug,
      segment_label = excluded.segment_label;

-- `other` is deliberately left unmapped, as it was under CATEGORY_KEYWORDS:
-- there is no real-world market to point a catch-all at, and inventing one
-- would be worse than the honest empty state the UI now renders.
