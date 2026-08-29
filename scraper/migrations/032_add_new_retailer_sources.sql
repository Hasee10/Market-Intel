-- Registers the 5 retailer sources added 2026-08-29 (bagallery,
-- junaidjamshed, gulahmed, chasevalue, alfatah - all Shopify storefronts,
-- see scraper/src/sources/shopify-source.ts) and maps their scraped
-- categories into the seller taxonomy from migration 020.
--
-- WHY THIS IS REQUIRED, NOT OPTIONAL: db.ts:getPlatformId() throws
-- `Unknown platform slug "<x>"` before writing a single row when a source has
-- no market_platforms entry - this is exactly how Daraz sat at zero rows for
-- days after its code shipped (migration 019 written but not applied), and
-- the same failure mode migration 023's own header warns about. Until this
-- migration runs, all five new sources fail on every run. Separately, even
-- with the platform registered, a source's products never surface on any
-- seller-facing page (Competitors, Market, matching) without the category
-- mapping below - getMarketScope() reads market_category_map, not
-- market_platforms, to resolve a seller category into scraped rows.
--
-- Apply manually via the Supabase SQL Editor, in order, same convention as
-- 001-031. Requires 020 (market_category_map) to have been applied already.
--
-- Khaadi (also on the original target list) is deliberately NOT here -
-- robots.txt disallows /women/, which is essentially its whole catalog.

-- ---------------------------------------------------------------------------
-- 1. The platforms
-- ---------------------------------------------------------------------------

insert into market_platforms (slug, name, base_url)
values
  ('bagallery',      'Bagallery',       'https://bagallery.com'),
  ('junaidjamshed',  'J. (Junaid Jamshed)', 'https://www.junaidjamshed.com'),
  ('gulahmed',       'Gul Ahmed (Ideas)',   'https://www.gulahmedshop.com'),
  ('chasevalue',     'Chase Value',     'https://chasevalue.pk'),
  ('alfatah',        'Al-Fatah',        'https://alfatah.pk')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Map their categories into the seller taxonomy
-- ---------------------------------------------------------------------------
--
-- Every (platform, category_slug) pair below matches the *_COLLECTIONS
-- values configured in .github/workflows/market-scraper.yml, and each handle
-- was fetched live on 2026-08-29 against its actual products.json endpoint
-- (not just /collections.json) and confirmed to return real product rows
-- before being listed here. Two initial picks (gulahmed's 2-piece-khaddar,
-- chasevalue's fryer) looked valid in /collections.json but had
-- products_count: 0 - real collections that are just currently empty - and
-- were swapped for women-ideas-pret / home-lifestyle-heater after verifying
-- those return live products. Nothing here is guessed.
--
-- These five were picked specifically to fill the category gaps named in the
-- original brief: beauty/personal-care, home-and-kitchen, toys-and-baby, and
-- fashion-and-apparel - categories the mobiles/electronics-heavy original
-- ten sources under-cover.

insert into market_category_map (platform_id, category_slug, seller_category_slug, segment_slug, segment_label)
select p.id, v.category_slug, v.seller_category_slug, v.segment_slug, v.segment_label
from (values
  -- === Bagallery - beauty/skincare, single retailer =======================
  ('bagallery', 'all-beauty',               'beauty-and-personal-care', 'beauty', 'Beauty & Cosmetics'),
  ('bagallery', 'all-skincare',              'beauty-and-personal-care', 'beauty', 'Beauty & Cosmetics'),
  ('bagallery', 'beauty-accessories-tools',  'beauty-and-personal-care', 'beauty', 'Beauty & Cosmetics'),
  ('bagallery', 'baby-care-1',               'toys-and-baby',            'baby',   'Baby & Nursery'),

  -- === J. (Junaid Jamshed) - ethnic fashion + fragrances ==================
  ('junaidjamshed', 'skin-care-body-care',   'beauty-and-personal-care', 'beauty',     'Beauty & Cosmetics'),
  ('junaidjamshed', 'fragrances-collection', 'beauty-and-personal-care', 'beauty',     'Beauty & Cosmetics'),
  ('junaidjamshed', 'womens-bags',           'fashion-and-apparel',      'accessories','Accessories'),
  ('junaidjamshed', '3-piece',               'fashion-and-apparel',      'womenswear', 'Womenswear'),

  -- === Gul Ahmed (Ideas) - fashion + home textiles ========================
  ('gulahmed', 'ideas-home-bed-sheets',  'home-and-kitchen',    'home',       'Home & Living'),
  ('gulahmed', 'ideas-home-bath-linen',  'home-and-kitchen',    'home',       'Home & Living'),
  ('gulahmed', 'women-ideas-pret',               'fashion-and-apparel', 'womenswear', 'Womenswear'),
  ('gulahmed', 'mens-clothes-eastern-shalwar-kameez', 'fashion-and-apparel', 'menswear', 'Menswear'),

  -- === Chase Value - broad department store ===============================
  ('chasevalue', 'home-fragrances',                 'home-and-kitchen',         'home',        'Home & Living'),
  ('chasevalue', 'home-lifestyle-heater',            'home-and-kitchen',         'appliances',  'Home Appliances'),
  ('chasevalue', 'kids-action-figures',              'toys-and-baby',            'toys',        'Toys & Games'),
  ('chasevalue', 'beauty-personal-care-shaving',     'beauty-and-personal-care', 'beauty',      'Beauty & Cosmetics'),

  -- === Al-Fatah - broad department store, best grocery/home/toys filler ===
  ('alfatah', 'air-fryer-price-in-pakistan',    'home-and-kitchen',         'appliances', 'Home Appliances'),
  ('alfatah', 'alarm-wall-clocks',              'home-and-kitchen',         'home',       'Home & Living'),
  ('alfatah', 'activity-toys',                  'toys-and-baby',            'toys',       'Toys & Games'),
  ('alfatah', 'after-shave-price-in-pakistan',  'beauty-and-personal-care', 'beauty',     'Beauty & Cosmetics')
) as v(platform_slug, category_slug, seller_category_slug, segment_slug, segment_label)
join market_platforms p on p.slug = v.platform_slug
on conflict (platform_id, category_slug, seller_category_slug) do update
  set segment_slug = excluded.segment_slug,
      segment_label = excluded.segment_label;
