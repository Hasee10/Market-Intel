-- Maps the collections added to JUNAIDJAMSHED_COLLECTIONS and
-- CHASEVALUE_COLLECTIONS on 2026-08-30. No new platforms here - both stores
-- were already registered in 032; this only widens which of their
-- collections get scraped, so it is category-map rows only.
--
-- Why: the 2026-08-29 run returned 23 products for junaidjamshed and 55 for
-- chasevalue. Both are large retailers - /collections.json lists 228 and 203
-- non-empty collections respectively - and the four handles configured for
-- each in 032 were all narrow sub-collections that happened to be nearly
-- empty. The additions below are each store's actual top-level catalogue.
--
-- Every handle was fetched live on 2026-08-30 against its real
-- /collections/<handle>/products.json endpoint (not just the collections
-- listing, same standard as 032/037/038/039) and returned a full page of
-- 250 products.
--
-- Ordering note, which matters more than usual here: saveProducts() dedupes
-- a run's products by external_id with last-one-wins, so when the same item
-- appears in two configured collections the LAST one determines its
-- category_slug. The workflow lists these broad collections *before* the
-- existing narrow ones so the narrow, more precise mapping still wins -
-- otherwise junaidjamshed's womens-bags (Accessories) would be swallowed by
-- women-collections (Womenswear). Keep that ordering if either list is
-- edited again.
--
-- Apply manually via the Supabase SQL Editor, same convention as 001-044.
-- Requires 020 (market_category_map) and 032 (these two platforms).

insert into market_category_map (platform_id, category_slug, seller_category_slug, segment_slug, segment_label)
select p.id, v.category_slug, v.seller_category_slug, v.segment_slug, v.segment_label
from (values
  -- === Junaid Jamshed - top-level catalogue ================================
  ('junaidjamshed', 'men-collections',        'fashion-and-apparel',      'menswear',   'Menswear'),
  ('junaidjamshed', 'women-collections',      'fashion-and-apparel',      'womenswear', 'Womenswear'),

  -- === Chase Value - top-level catalogue ===================================
  ('chasevalue',    'beauty-personal-care',   'beauty-and-personal-care', 'beauty',     'Beauty & Cosmetics'),
  ('chasevalue',    'kids-boys-clothes',      'fashion-and-apparel',      'kidswear',   'Kidswear'),
  ('chasevalue',    'home-lifestyle-bedding', 'home-and-kitchen',         'home',       'Home & Living')
) as v(platform_slug, category_slug, seller_category_slug, segment_slug, segment_label)
join market_platforms p on p.slug = v.platform_slug
on conflict (platform_id, category_slug, seller_category_slug) do update
  set segment_slug = excluded.segment_slug,
      segment_label = excluded.segment_label;
