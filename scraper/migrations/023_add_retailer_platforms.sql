-- Registers the four retailer sources added on 2026-08-03 (mega, naheed,
-- vmart, shopperspk) and maps their scraped categories into the seller
-- taxonomy from migration 020.
--
-- WHY THIS IS REQUIRED, NOT OPTIONAL: db.ts:getPlatformId() throws
-- `Unknown platform slug "<x>"` before writing a single row when a source has
-- no market_platforms entry. That is exactly how Daraz sat at zero rows for
-- days after its code shipped (migration 019 was written but never applied).
-- Until this migration runs, all four new sources fail on every run and their
-- products land nowhere.
--
-- Apply manually via the Supabase SQL Editor, in order, same convention as
-- 001-022. Requires 020 (market_category_map) to have been applied already.

-- ---------------------------------------------------------------------------
-- 1. The platforms
-- ---------------------------------------------------------------------------

insert into market_platforms (slug, name, base_url)
values
  ('mega',        'Mega.pk',     'https://www.mega.pk'),
  ('naheed',      'Naheed.pk',   'https://www.naheed.pk'),
  ('vmart',       'Vmart.pk',    'https://vmart.pk'),
  ('shopperspk',  'ShoppersPK',  'https://www.shopperspk.com')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Map their categories into the seller taxonomy
-- ---------------------------------------------------------------------------
--
-- Every (platform, category_slug) pair below matches the *_CATEGORIES values
-- configured in .github/workflows/market-scraper.yml, and each slug was
-- fetched live on 2026-08-03 and confirmed to return real product cards
-- before being listed here. Nothing is guessed.
--
-- The point of these four sources is the ten seller categories that had no
-- retailer coverage at all once OLX was disabled (ROADMAP.md D4): naheed and
-- shopperspk are what finally give home-and-kitchen, beauty-and-personal-care,
-- grocery-and-food, toys-and-baby, health-and-wellness and
-- books-and-stationery real scraped rows instead of an honest-empty state.

insert into market_category_map (platform_id, category_slug, seller_category_slug, segment_slug, segment_label)
select p.id, v.category_slug, v.seller_category_slug, v.segment_slug, v.segment_label
from (values
  -- === Mega.pk - electronics and appliances ==============================
  ('mega', 'laptops',            'mobiles-and-electronics', 'laptops',     'Laptops & Computing'),
  ('mega', 'desktopcomputers',   'mobiles-and-electronics', 'laptops',     'Laptops & Computing'),
  ('mega', 'mobiles',            'mobiles-and-electronics', 'phones',      'Phones'),
  ('mega', 'smartwatches',       'mobiles-and-electronics', 'wearables',   'Wearables'),
  ('mega', 'ledtv',              'mobiles-and-electronics', 'tv',          'TV & Home Entertainment'),
  ('mega', 'airconditioners',    'home-and-kitchen',        'appliances',  'Home Appliances'),
  ('mega', 'refrigerators',      'home-and-kitchen',        'appliances',  'Home Appliances'),
  ('mega', 'microwaveovens',     'home-and-kitchen',        'appliances',  'Home Appliances'),

  -- === Naheed.pk - the broadest category spread of any source we have ====
  ('naheed', 'phones-tablets',      'mobiles-and-electronics',  'phones',     'Phones'),
  ('naheed', 'tv-home-appliances',  'home-and-kitchen',         'appliances', 'Home Appliances'),
  ('naheed', 'home-lifestyle',      'home-and-kitchen',         'home',       'Home & Living'),
  ('naheed', 'health-beauty',       'beauty-and-personal-care', 'beauty',     'Beauty & Cosmetics'),
  ('naheed', 'health-beauty',       'health-and-wellness',      'health',     'Health & Supplements'),
  ('naheed', 'groceries-pets',      'grocery-and-food',         'grocery',    'Grocery & Household'),
  ('naheed', 'kids-babies',         'toys-and-baby',            'baby',       'Baby & Nursery'),
  ('naheed', 'books',               'books-and-stationery',     'books',      'Books'),
  ('naheed', 'men-s-fashion',       'fashion-and-apparel',      'menswear',   'Menswear'),

  -- === Vmart.pk - computing/gaming peripherals ===========================
  ('vmart', 'apple-phones',              'mobiles-and-electronics', 'phones',      'Phones'),
  ('vmart', 'apple-macbooks-pakistan',   'mobiles-and-electronics', 'laptops',     'Laptops & Computing'),
  ('vmart', 'audio-pakistan',            'mobiles-and-electronics', 'audio',       'Audio'),
  ('vmart', 'gaming-mouse-pakistan',     'mobiles-and-electronics', 'accessories', 'Accessories'),
  ('vmart', 'gaming-keyboards-pakistan', 'mobiles-and-electronics', 'accessories', 'Accessories'),
  ('vmart', 'gaming-headsets-pakistan',  'mobiles-and-electronics', 'audio',       'Audio'),
  ('vmart', 'accessories-pakistan',      'mobiles-and-electronics', 'accessories', 'Accessories'),

  -- === ShoppersPK - home, kitchen and general merchandise ================
  ('shopperspk', 'home-decor',                  'home-and-kitchen', 'furniture', 'Furniture & Decor'),
  ('shopperspk', 'wall-clocks-in-pakistan',     'home-and-kitchen', 'furniture', 'Furniture & Decor'),
  ('shopperspk', 'jars-containers',             'home-and-kitchen', 'kitchen',   'Kitchen & Dining'),
  ('shopperspk', 'serving-dishes-in-pakistan',  'home-and-kitchen', 'kitchen',   'Kitchen & Dining'),
  ('shopperspk', 'water-bottles-in-pakistan',   'home-and-kitchen', 'kitchen',   'Kitchen & Dining'),
  ('shopperspk', 'mugs-in-pakistan',            'home-and-kitchen', 'kitchen',   'Kitchen & Dining'),
  ('shopperspk', 'air-fryers',                  'home-and-kitchen', 'appliances','Home Appliances'),
  ('shopperspk', 'baby',                        'toys-and-baby',    'baby',      'Baby & Nursery')
) as v(platform_slug, category_slug, seller_category_slug, segment_slug, segment_label)
join market_platforms p on p.slug = v.platform_slug
on conflict (platform_id, category_slug, seller_category_slug) do update
  set segment_slug = excluded.segment_slug,
      segment_label = excluded.segment_label;
