-- Registers the 8 retailer sources added 2026-08-29 (sixth batch, the last
-- of the weak/critical-gap-category work: Health & Wellness + 2 more pet
-- sources + 2 more coffee/tea specialty roasters) and, separately,
-- formalizes "Pet Supplies" as its own seller_categories row instead of the
-- catch-all 'other' it used before. This round's brief explicitly asked for
-- both, unlike when the gap was first flagged (033/034's header comments)
-- and deliberately left alone as a bigger decision than one migration
-- should make silently.
--
-- Unlike the last 3 batches, no specific sites were named for these three
-- gaps in the brief ("research and propose") - all 8 were found via live
-- web search, then verified the same way as every named candidate before
-- them (robots.txt + actual endpoint fetch, not taken on faith).
--
-- Apply manually via the Supabase SQL Editor, in order, same convention as
-- 001-038. Requires 020 (market_category_map) to have been applied already.

-- ---------------------------------------------------------------------------
-- 1. Formalize Pet Supplies as its own seller category
-- ---------------------------------------------------------------------------
--
-- Was mapped to the catch-all 'other' since Petfit.pk/Petshub.pk were added
-- (033/034) - explicitly flagged at the time as a bigger decision than one
-- migration should make (it also touches the Settings > Domains "Add a
-- category" dropdown, sourced live from this table - see
-- listCategories() in seller.ts, and CATEGORY_VISUALS in the seller app's
-- categoryVisuals.ts, updated alongside this migration to add a Pet icon).

insert into seller_categories (slug, name)
values ('pet-supplies', 'Pet Supplies')
on conflict (slug) do nothing;

-- Re-map the *existing* Petfit.pk/Petshub.pk rows from 'other' to the new
-- category - an UPDATE, not a fresh insert, since (platform_id,
-- category_slug, seller_category_slug) is the unique key and changing
-- seller_category_slug means the old 'other' row and the new
-- 'pet-supplies' row are different keys entirely; without this they'd
-- double-map the same source into two seller categories at once.
update market_category_map
set seller_category_slug = 'pet-supplies'
where seller_category_slug = 'other'
  and platform_id in (select id from market_platforms where slug in ('petfit', 'petshub'));

-- ---------------------------------------------------------------------------
-- 2. The new platforms
-- ---------------------------------------------------------------------------

insert into market_platforms (slug, name, base_url)
values
  ('wellpakistan',        'Well Pakistan',       'https://wellpakistan.com'),
  ('myvitaminstore',       'My Vitamin Store',    'https://www.myvitaminstore.pk'),
  ('ginnasticnutrition',   'Ginnastic Nutrition', 'https://www.ginnasticnutrition.com'),
  ('petmaster',            'Pet Master',          'https://petmaster.pk'),
  ('petspark',             'PetsPark.pk',         'https://petspark.pk'),
  ('epetstorepk',          'ePetStore.pk',        'https://www.epetstore.pk'),
  ('scafe',                'SCAFE Coffee Roaster','https://scafe.pk'),
  ('redberryroasters',     'Red Berry Roasters',  'https://redberryroasters.com')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Map their categories into the seller taxonomy
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
  -- === Health & Wellness ===================================================
  ('wellpakistan',      'health-wellness',            'health-and-wellness', 'supplements', 'Vitamins & Supplements'),
  ('wellpakistan',      'health-care-supplements',    'health-and-wellness', 'supplements', 'Vitamins & Supplements'),
  ('wellpakistan',      'multivitamins',              'health-and-wellness', 'supplements', 'Vitamins & Supplements'),
  ('wellpakistan',      'nutritional-supplements',    'health-and-wellness', 'supplements', 'Vitamins & Supplements'),
  ('myvitaminstore',    'bone-muscle-joint-health-supplements', 'health-and-wellness', 'supplements', 'Vitamins & Supplements'),
  ('myvitaminstore',    'energy-vitality-supplements',          'health-and-wellness', 'supplements', 'Vitamins & Supplements'),
  ('myvitaminstore',    'brain-health',                          'health-and-wellness', 'supplements', 'Vitamins & Supplements'),
  ('myvitaminstore',    'calcium-magnesium',                     'health-and-wellness', 'supplements', 'Vitamins & Supplements'),
  ('ginnasticnutrition','post-workout',   'health-and-wellness', 'fitness-nutrition', 'Sports Nutrition'),
  ('ginnasticnutrition','diabetes',       'health-and-wellness', 'supplements',       'Vitamins & Supplements'),
  ('ginnasticnutrition','brain-health',   'health-and-wellness', 'supplements',       'Vitamins & Supplements'),
  ('ginnasticnutrition','pre-workout',    'health-and-wellness', 'fitness-nutrition', 'Sports Nutrition'),

  -- === Pet Supplies (formalized above) ====================================
  ('petmaster',   'cats',                            'pet-supplies', 'pets', 'Pet Supplies'),
  ('petmaster',   'dog',                              'pet-supplies', 'pets', 'Pet Supplies'),
  ('petmaster',   'cat-treats',                       'pet-supplies', 'pets', 'Pet Supplies'),
  ('petmaster',   'dog-dry-food-1',                   'pet-supplies', 'pets', 'Pet Supplies'),
  ('petspark',    'cat-accessories',                  'pet-supplies', 'pets', 'Pet Supplies'),
  ('petspark',    'dogs',                             'pet-supplies', 'pets', 'Pet Supplies'),
  ('petspark',    'dog-accessories',                  'pet-supplies', 'pets', 'Pet Supplies'),
  ('petspark',    'cat-dry-food',                     'pet-supplies', 'pets', 'Pet Supplies'),
  ('epetstorepk', 'cat-food-in-pakistan',             'pet-supplies', 'pets', 'Pet Supplies'),
  ('epetstorepk', 'pet-accessories-in-pakistan',      'pet-supplies', 'pets', 'Pet Supplies'),
  ('epetstorepk', 'dog-accessories-in-pakistan',      'pet-supplies', 'pets', 'Pet Supplies'),
  ('epetstorepk', 'dog-food-in-pakistan',             'pet-supplies', 'pets', 'Pet Supplies'),

  -- === Coffee & Beverages ==================================================
  ('scafe',            'coffee',                'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('scafe',            'single-origin',         'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('scafe',            'flavoured-syrups',      'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('scafe',            'matcha',                'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('redberryroasters',  'all-coffee',            'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('redberryroasters',  'single-origin-coffee',  'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('redberryroasters',  'espresso-coffee',       'coffee-and-beverages', 'beverages', 'Coffee & Beverages'),
  ('redberryroasters',  'medium-coffee',         'coffee-and-beverages', 'beverages', 'Coffee & Beverages')
) as v(platform_slug, category_slug, seller_category_slug, segment_slug, segment_label)
join market_platforms p on p.slug = v.platform_slug
on conflict (platform_id, category_slug, seller_category_slug) do update
  set segment_slug = excluded.segment_slug,
      segment_label = excluded.segment_label;
