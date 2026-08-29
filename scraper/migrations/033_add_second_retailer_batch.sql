-- Registers the 4 retailer sources added 2026-08-29 (second batch: springs,
-- outfitters, sewmarkaz, petshub) and maps their scraped categories into the
-- seller taxonomy from migration 020. Same two-part requirement as every
-- prior source addition - see migration 032's header for why both halves
-- are mandatory, not optional.
--
-- Apply manually via the Supabase SQL Editor, in order, same convention as
-- 001-032. Requires 020 (market_category_map) to have been applied already.
--
-- Candidates evaluated from the same list and NOT added here:
--   - Symbios.pk: dead/misconfigured host - both robots.txt and the homepage
--     serve a FASTPANEL hosting-control-panel splash page, not real content.
--   - METRO Pakistan (metro.pk): hard 403 block on every request, including
--     robots.txt itself - real bot protection, not attempted further.
--   - Homeshopping.pk: a real store, but built on VTEX (headless commerce,
--     React SPA) - no simple product JSON on the page, needs its Search API
--     investigated separately. Deferred, not attempted this pass.
--   - Idealancy.pk: a real store on a custom platform ("Mimcart by Mimsoft"),
--     has per-page JSON-LD product data but no bulk JSON endpoint - needs a
--     bespoke HTML/JSON-LD source file (like daraz.ts), more work than a
--     factory reuse. Deferred, not attempted this pass.
--
-- TAXONOMY GAP, FLAGGED NOT DECIDED: seller_categories has no "Pets" entry
-- (the 12 rows are fixed: mobiles-and-electronics, fashion-and-apparel,
-- beauty-and-personal-care, coffee-and-beverages, grocery-and-food,
-- home-and-kitchen, books-and-stationery, toys-and-baby, sports-and-outdoors,
-- automotive, health-and-wellness, other). Petshub's products are mapped to
-- 'other' below rather than force-fit into an unrelated category or having
-- this migration unilaterally add a new top-level seller category (that also
-- touches onboarding/domain-selection UI, a bigger decision than one
-- migration should make silently).

-- ---------------------------------------------------------------------------
-- 1. The platforms
-- ---------------------------------------------------------------------------

insert into market_platforms (slug, name, base_url)
values
  ('springs',     'Springs',      'https://springs.com.pk'),
  ('outfitters',  'Outfitters',   'https://outfitters.com.pk'),
  ('sewmarkaz',   'SEW Markaz',   'https://www.sewmarkaz.com'),
  ('petshub',     'Petshub.pk',   'https://www.petshub.pk')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Map their categories into the seller taxonomy
-- ---------------------------------------------------------------------------
--
-- Every (platform, category_slug) pair below matches the *_COLLECTIONS /
-- *_CATEGORIES values configured in .github/workflows/market-scraper.yml,
-- and each handle was fetched live on 2026-08-29 against its actual
-- products.json (Shopify) or Store API (WooCommerce) endpoint - not just the
-- collection/category listing - and confirmed to return real product rows
-- before being listed here.

insert into market_category_map (platform_id, category_slug, seller_category_slug, segment_slug, segment_label)
select p.id, v.category_slug, v.seller_category_slug, v.segment_slug, v.segment_label
from (values
  -- === Springs - grocery/pantry, household, baby, beauty =================
  ('springs', 'chips-snacks-popcorn',    'grocery-and-food',         'pantry',  'Pantry & Snacks'),
  ('springs', 'cleaning',                'home-and-kitchen',         'home',    'Home & Living'),
  ('springs', 'baby-products',           'toys-and-baby',            'baby',    'Baby & Nursery'),
  ('springs', 'beauty-accessories-tools','beauty-and-personal-care', 'beauty',  'Beauty & Cosmetics'),

  -- === Outfitters - western/kids fashion, high volume ====================
  ('outfitters', 'boys-most-popular-products',  'fashion-and-apparel', 'kidswear',    'Kidswear'),
  ('outfitters', 'girls-most-popular-products', 'fashion-and-apparel', 'kidswear',    'Kidswear'),
  ('outfitters', 'accessories-women',           'fashion-and-apparel', 'accessories', 'Accessories'),
  ('outfitters', 'junior-boy-shoes',             'fashion-and-apparel', 'footwear',    'Footwear'),

  -- === SEW Markaz - home decor, kitchen, storage ==========================
  ('sewmarkaz', 'home-decor',           'home-and-kitchen', 'home',    'Home & Living'),
  ('sewmarkaz', 'kitchen-dining',       'home-and-kitchen', 'kitchen', 'Kitchen & Dining'),
  ('sewmarkaz', 'household-essentials', 'home-and-kitchen', 'home',    'Home & Living'),
  ('sewmarkaz', 'baskets-organizers',   'home-and-kitchen', 'storage', 'Storage & Organization'),

  -- === Petshub.pk - pet supplies (no dedicated seller category, see above)
  ('petshub', 'cat-foods-in-pakistan',        'other', 'pets', 'Pet Supplies'),
  ('petshub', 'dog-foods-in-pakistan',        'other', 'pets', 'Pet Supplies'),
  ('petshub', 'cat-accessories-in-pakistan',  'other', 'pets', 'Pet Supplies'),
  ('petshub', 'dog-accessories-in-pakistan',  'other', 'pets', 'Pet Supplies')
) as v(platform_slug, category_slug, seller_category_slug, segment_slug, segment_label)
join market_platforms p on p.slug = v.platform_slug
on conflict (platform_id, category_slug, seller_category_slug) do update
  set segment_slug = excluded.segment_slug,
      segment_label = excluded.segment_label;
