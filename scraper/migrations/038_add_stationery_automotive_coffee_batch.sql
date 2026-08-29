-- Registers the 12 retailer sources added 2026-08-29 (fifth batch,
-- targeting Books & Stationery, Automotive and Coffee & Beverages - the
-- other three weak/critical-gap categories from the same brief the Sports
-- & Outdoors batch (migration 037) started) and maps their scraped
-- categories into the seller taxonomy from migration 020. Same two-part
-- requirement as every prior source addition - see migration 032's header
-- for why both halves are mandatory, not optional.
--
-- Apply manually via the Supabase SQL Editor, in order, same convention as
-- 001-037. Requires 020 (market_category_map) to have been applied already.
--
-- Candidate evaluated and NOT added: Waqarmart.pk - a real, live site, but
-- a custom Laravel-based platform (not WordPress, despite having a
-- /wp-json/ path that turned out to just redirect to itself - the real
-- response is a Laravel/Blade app), no standard product-feed endpoint.
-- Needs a bespoke HTML/JSON-LD source file, same bucket as
-- Idealancy.pk/TheSportStore.pk from earlier batches.
--
-- Snapcart.pk is a large general marketplace (100k+ products spanning
-- pharmacy, beauty, groceries too) - only its genuine Tea & Coffee segment
-- (916 real products) is scraped here, not the whole catalog.

-- ---------------------------------------------------------------------------
-- 1. The platforms
-- ---------------------------------------------------------------------------

insert into market_platforms (slug, name, base_url)
values
  ('blingspot',        'BlingSpot.pk',       'https://blingspot.pk'),
  ('katib',             'Katib.pk',           'https://katib.pk'),
  ('mercurystationery', 'Mercury Stationery', 'https://mercurystationery.com'),
  ('stationarypk',      'Stationery.pk',      'https://stationary.pk'),
  ('assany',            'Assany.pk',          'https://assany.pk'),
  ('sehgalmotors',      'SehgalMotors.pk',    'https://sehgalmotors.pk'),
  ('asadautos',         'AsadAutos.pk',       'https://asadautos.pk'),
  ('pakistanmotors',    'PakistanMotors.pk',  'https://pakistanmotors.pk'),
  ('premiumexo',        'PremiumExo',         'https://premiumexo.com'),
  ('autostorepk',       'Autostore.pk',       'https://www.autostore.pk'),
  ('coffeecrest',       'Coffee Crest',       'https://coffeecrest.pk'),
  ('snapcart',          'Snapcart.pk',        'https://snapcart.pk')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Map their categories into the seller taxonomy
-- ---------------------------------------------------------------------------
--
-- Every (platform, category_slug) pair below matches the *_COLLECTIONS /
-- *_CATEGORIES values configured in .github/workflows/market-scraper.yml,
-- and each handle was fetched live on 2026-08-29 against its actual
-- products.json (Shopify) or Store API (WooCommerce) endpoint - not just
-- the collection/category listing - and confirmed to return real product
-- rows before being listed here.

insert into market_category_map (platform_id, category_slug, seller_category_slug, segment_slug, segment_label)
select p.id, v.category_slug, v.seller_category_slug, v.segment_slug, v.segment_label
from (values
  -- === Books & Stationery =================================================
  ('blingspot',        'school-supplies',            'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('blingspot',        'kids-stationery',             'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('blingspot',        'journals-notebooks',          'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('blingspot',        'notepads',                    'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('katib',             'art-and-craft',               'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('katib',             'copy-and-printer-paper',      'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('katib',             'account-books',               'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('katib',             'data-storage',                'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('mercurystationery', 'all-pencils',                 'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('mercurystationery', 'all-pens',                    'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('mercurystationery', 'lead-pencils',                'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('mercurystationery', 'brito',                       'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('stationarypk',      'writing-essentials',          'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('stationarypk',      'office-supplies',             'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('stationarypk',      'school-supplies-pakistan',    'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('stationarypk',      'lead-pencil-pakistan',        'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('assany',            'stationery',                  'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('assany',            'arts-crafts',                 'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('assany',            'packaging-material',          'books-and-stationery', 'stationery', 'Books & Stationery'),
  ('assany',            'wall-racks-organizers',       'books-and-stationery', 'stationery', 'Books & Stationery'),

  -- === Automotive ==========================================================
  ('sehgalmotors',   'auto-spare-parts',                  'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('sehgalmotors',   'body-kits-extensions',              'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('sehgalmotors',   'bike-accessories',                  'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('sehgalmotors',   'air-press-sunvisors',               'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('asadautos',      'honda',                             'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('asadautos',      'all-type-of-mats',                  'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('asadautos',      'haval',                             'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('asadautos',      'goodyear-wiper-blades',             'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('pakistanmotors', 'interior-accessories',              'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('pakistanmotors', 'led-lightening-accessories',        'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('pakistanmotors', 'car-top-covers',                    'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('pakistanmotors', 'exterior-accessories',              'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('premiumexo',     'car-window-sunshades-pakistan',     'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('premiumexo',     'toyota-sunshades-pakistan',         'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('premiumexo',     'honda-sunshades-pakistan',          'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('premiumexo',     'back-rear',                         'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('autostorepk',    'car-accessories',                   'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('autostorepk',    'body-kits',                         'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('autostorepk',    'car-care',                          'automotive', 'parts-accessories', 'Auto Parts & Accessories'),
  ('autostorepk',    'car-parts',                         'automotive', 'parts-accessories', 'Auto Parts & Accessories'),

  -- === Coffee & Beverages (previously 0 active sources - now formalized) ==
  ('coffeecrest', 'beverages-drinks',        'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('coffeecrest', 'syrups',                  'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('coffeecrest', 'single-origin',           'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('coffeecrest', 'blends',                  'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('snapcart',    'tea-coffee',              'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('snapcart',    'drinks',                  'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('snapcart',    'juices-malts-smoothies',  'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('snapcart',    'soft-drinks-soda',        'coffee-and-beverages', 'beverages', 'Coffee & Beverages')
) as v(platform_slug, category_slug, seller_category_slug, segment_slug, segment_label)
join market_platforms p on p.slug = v.platform_slug
on conflict (platform_id, category_slug, seller_category_slug) do update
  set segment_slug = excluded.segment_slug,
      segment_label = excluded.segment_label;
