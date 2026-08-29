-- Registers the 5 retailer sources added 2026-08-29 (fourth batch,
-- targeting Sports & Outdoors - the weakest-covered seller category before
-- this, with only 2 sources) and maps their scraped categories into the
-- seller taxonomy from migration 020. Same two-part requirement as every
-- prior source addition - see migration 032's header for why both halves
-- are mandatory, not optional.
--
-- Apply manually via the Supabase SQL Editor, in order, same convention as
-- 001-036. Requires 020 (market_category_map) to have been applied already.
--
-- Candidates evaluated from the same (user-provided) Sports & Outdoors list
-- and NOT added here:
--   - TheSportStore.pk: a real, live site (confirmed 200 on its homepage
--     with a genuine title), but runs OpenCart with no standard product-feed
--     endpoint - no /collections.json, no WooCommerce Store API. Needs a
--     bespoke HTML/JSON-LD source file, deferred rather than rushed, same
--     bucket as Idealancy.pk/Homeshopping.pk from earlier batches.
--
-- Site-specific quirk worth remembering: Zeesol Store's WooCommerce Store
-- API rejects category *slugs* - `?category=gym-accessories` returns an
-- empty array despite that category genuinely having 124 products, but
-- `?category=3962` (the numeric category ID) works. Every other WooCommerce
-- source added so far (petshub, shopperspk, petfit, luminaria) accepts
-- slugs fine - this is the first one that doesn't. Config values for
-- zeesol below are IDs, not slugs.

-- ---------------------------------------------------------------------------
-- 1. The platforms
-- ---------------------------------------------------------------------------

insert into market_platforms (slug, name, base_url)
values
  ('alisports',      'Ali Sports',        'https://www.alisports.pk'),
  ('bodybrics',       'Bodybrics',         'https://bodybrics.com'),
  ('hustlersonlypk',  'Hustlers Only PK',  'https://hustlersonlypk.com'),
  ('activitysphere',  'Activity Sphere',   'https://activitysphere.pk'),
  ('zeesol',          'Zeesol Store',      'https://www.zeesol.net')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Map their categories into the seller taxonomy
-- ---------------------------------------------------------------------------
--
-- Every (platform, category_slug) pair below matches the *_COLLECTIONS /
-- *_CATEGORIES values configured in .github/workflows/market-scraper.yml,
-- and each handle/ID was fetched live on 2026-08-29 against its actual
-- products.json (Shopify) or Store API (WooCommerce) endpoint - not just
-- the collection/category listing - and confirmed to return real product
-- rows before being listed here.
--
-- Bodybrics/HustlersOnlyPK/ActivitySphere lean gym-wear/activewear rather
-- than sports equipment - still mapped to sports-and-outdoors (fitness
-- apparel is a real part of that market), not fashion-and-apparel, since
-- that's what they're competing on.

insert into market_category_map (platform_id, category_slug, seller_category_slug, segment_slug, segment_label)
select p.id, v.category_slug, v.seller_category_slug, v.segment_slug, v.segment_label
from (values
  -- === Ali Sports - sports equipment ======================================
  ('alisports', 'badminton',          'sports-and-outdoors', 'equipment', 'Sports Equipment'),
  ('alisports', 'cricket',            'sports-and-outdoors', 'equipment', 'Sports Equipment'),
  ('alisports', 'badminton-rackets',  'sports-and-outdoors', 'equipment', 'Sports Equipment'),
  ('alisports', 'exercise-fitness',   'sports-and-outdoors', 'fitness',   'Fitness & Gym'),

  -- === Bodybrics - gym/fitness apparel & accessories ======================
  ('bodybrics', 'accessories',                    'sports-and-outdoors', 'fitness', 'Fitness & Gym'),
  ('bodybrics', 't-shirts-tops',                  'sports-and-outdoors', 'apparel', 'Activewear'),
  ('bodybrics', 'mens-pants-trousers-joggers',    'sports-and-outdoors', 'apparel', 'Activewear'),
  ('bodybrics', 'all-women',                       'sports-and-outdoors', 'apparel', 'Activewear'),

  -- === Hustlers Only PK - fitness apparel =================================
  ('hustlersonlypk', 'fitness-apparel', 'sports-and-outdoors', 'apparel', 'Activewear'),
  ('hustlersonlypk', 'apparel-men',     'sports-and-outdoors', 'apparel', 'Activewear'),
  ('hustlersonlypk', 'women-apparel',   'sports-and-outdoors', 'apparel', 'Activewear'),
  ('hustlersonlypk', 'tops',            'sports-and-outdoors', 'apparel', 'Activewear'),

  -- === Activity Sphere - gym wear / activewear =============================
  ('activitysphere', 'women-gym-wear',   'sports-and-outdoors', 'apparel', 'Activewear'),
  ('activitysphere', 'men-gym-wear',     'sports-and-outdoors', 'apparel', 'Activewear'),
  ('activitysphere', 'women-sports-bra', 'sports-and-outdoors', 'apparel', 'Activewear'),
  ('activitysphere', 'men-gym-shirts',   'sports-and-outdoors', 'apparel', 'Activewear'),

  -- === Zeesol Store - fitness equipment (config values are numeric IDs) ===
  ('zeesol', '3962', 'sports-and-outdoors', 'fitness', 'Fitness & Gym'),
  ('zeesol', '3961', 'sports-and-outdoors', 'fitness', 'Fitness & Gym'),
  ('zeesol', '3966', 'sports-and-outdoors', 'fitness', 'Fitness & Gym'),
  ('zeesol', '3963', 'sports-and-outdoors', 'fitness', 'Fitness & Gym')
) as v(platform_slug, category_slug, seller_category_slug, segment_slug, segment_label)
join market_platforms p on p.slug = v.platform_slug
on conflict (platform_id, category_slug, seller_category_slug) do update
  set segment_slug = excluded.segment_slug,
      segment_label = excluded.segment_label;
