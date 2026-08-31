-- Second widening pass, 2026-08-30 (see 045 for the first). No new
-- platforms - all six were already registered in 037/038/039; this only
-- adds category-map rows for the new collections in market-scraper.yml.
--
-- sewmarkaz and ginnasticnutrition were checked and left alone: both are
-- small stores (14 and 10 non-empty collections respectively) whose
-- existing 4 configured collections already are the store's largest -
-- there was nothing to widen.
--
-- Every handle below was fetched live on 2026-08-30 against its real
-- /collections/<handle>/products.json endpoint and returned real product
-- rows, same standard as 001-045.
--
-- Ordering in the workflow lists each new broad handle before the existing
-- narrower ones for the same store, same last-one-wins reasoning as 045.
--
-- Apply manually via the Supabase SQL Editor, same convention as 001-045.
-- Requires 020 (market_category_map) and 037/038/039 (these six platforms).

insert into market_category_map (platform_id, category_slug, seller_category_slug, segment_slug, segment_label)
select p.id, v.category_slug, v.seller_category_slug, v.segment_slug, v.segment_label
from (values
  -- === Bodybrics - men's line, mirrors the existing all-women entry ========
  ('bodybrics',         'all-men',                'sports-and-outdoors',   'apparel',   'Activewear'),

  -- === ActivitySphere - second-largest collection, uncovered ==============
  ('activitysphere',    'women-leggings',         'sports-and-outdoors',   'apparel',   'Activewear'),

  -- === Mercury Stationery - largest collection, uncovered ==================
  ('mercurystationery', 'all-markers',             'books-and-stationery',  'stationery','Books & Stationery'),

  -- === Coffee Crest - small store, one real remaining gap ==================
  ('coffeecrest',       'coffee-beans',            'coffee-and-beverages',  'beverages', 'Coffee & Beverages'),

  -- === Well Pakistan - largest collection by far, uncovered ================
  -- A standard pharmacy/wellness-retail category (not adult content), given
  -- its own segment rather than folded into supplements, which it isn't.
  ('wellpakistan',      'male-sexual-wellness',    'health-and-wellness',   'wellness',  'Personal Wellness'),

  -- === Scafe / Red Berry Roasters - brewing equipment, not beans ===========
  -- Both stores' two largest collections were equipment/gear, entirely
  -- missing from the beans-and-syrups-only config in 039.
  ('scafe',             'brewing-equipment',       'coffee-and-beverages',  'equipment', 'Brewing Equipment'),
  ('scafe',             'coffee-brewing-tools',    'coffee-and-beverages',  'equipment', 'Brewing Equipment'),
  ('redberryroasters',  'all-gear',                'coffee-and-beverages',  'equipment', 'Brewing Equipment'),
  ('redberryroasters',  'all-accessories',         'coffee-and-beverages',  'equipment', 'Brewing Equipment')
) as v(platform_slug, category_slug, seller_category_slug, segment_slug, segment_label)
join market_platforms p on p.slug = v.platform_slug
on conflict (platform_id, category_slug, seller_category_slug) do update
  set segment_slug = excluded.segment_slug,
      segment_label = excluded.segment_label;
