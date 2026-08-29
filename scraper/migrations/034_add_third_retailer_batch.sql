-- Registers the 11 retailer sources added 2026-08-29 (third batch: fashion -
-- zellbury, bonanzasatrangi, beechtree, nishatlinen; furniture/home -
-- interwood, habitt, poshish, woods; chenone (apparel + home textile);
-- pets/decor - petfit, luminaria) and maps their scraped categories into the
-- seller taxonomy from migration 020. Same two-part requirement as every
-- prior source addition - see migration 032's header for why both halves
-- are mandatory, not optional.
--
-- Apply manually via the Supabase SQL Editor, in order, same convention as
-- 001-033. Requires 020 (market_category_map) to have been applied already.
--
-- Candidates evaluated from the same (Grok-researched) list and NOT added:
--   - Ethnic/Ethnc, Highfy (.pk and .com), Malabis (.com and .pk): every
--     domain variant resolved to a parked or unrelated page (Highfy.pk
--     literally serves an "American Express" page; Malabis.com's own
--     <title> is just "malabis.com", a classic parking placeholder), not a
--     real store. Not attempted further.
--   - Nested.pk: a real store, but a heavily client-rendered SPA (Vue
--     "Materio" admin-dashboard template) with no server-rendered product
--     data - would need its backend API reverse-engineered separately,
--     deferred rather than rushed.
--
-- DATA-QUALITY FIXES that came out of verifying this batch, applying to
-- every Shopify/WooCommerce source (not just the new ones):
--   - A handful of Habitt/Woods/Petfit listings are "$0.00" B2B/custom
--     items ("contact for quote") rather than missing a price - these are
--     now filtered out entirely (shopify-source.ts, woocommerce-source.ts)
--     rather than written in as a fake "cheapest price: Rs 0".
--   - WooCommerce Store API product names come HTML-entity-encoded
--     ("Tamy&#8217;s Cat Wet Food") - now decoded (polite.ts's new
--     decodeHtmlEntities()). This was already a live bug in shipped
--     shopperspk.ts (in production for weeks) and petshub.ts (27% of
--     titles affected), fixed there too, not just in the new sources.

-- ---------------------------------------------------------------------------
-- 1. The platforms
-- ---------------------------------------------------------------------------

insert into market_platforms (slug, name, base_url)
values
  ('zellbury',        'Zellbury',         'https://zellbury.com'),
  ('bonanzasatrangi',  'Bonanza Satrangi', 'https://bonanzasatrangi.com'),
  ('beechtree',        'Beechtree',        'https://beechtree.pk'),
  ('nishatlinen',      'Nishat Linen',     'https://nishatlinen.com'),
  ('interwood',        'Interwood',        'https://interwood.pk'),
  ('habitt',           'Habitt',           'https://habitt.com'),
  ('poshish',          'Poshish',          'https://poshish.pk'),
  ('woods',            'Woods.pk',         'https://woods.pk'),
  ('chenone',          'ChenOne',          'https://chenone.com'),
  ('petfit',           'PetFit.pk',        'https://petfit.pk'),
  ('luminaria',        'Luminaria.pk',     'https://luminaria.pk')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Map their categories into the seller taxonomy
-- ---------------------------------------------------------------------------
--
-- Every (platform, category_slug) pair below matches the *_COLLECTIONS /
-- *_CATEGORIES values configured in .github/workflows/market-scraper.yml,
-- and each handle was fetched live on 2026-08-29 against its actual
-- products.json (Shopify) or Store API (WooCommerce) endpoint - not just the
-- collection/category listing - and confirmed to return real product rows,
-- re-verified again after the $0-price and HTML-entity fixes above.
--
-- Petfit maps to 'other'/pets, same taxonomy-gap note as migration 033:
-- seller_categories has no dedicated "Pets" entry.

insert into market_category_map (platform_id, category_slug, seller_category_slug, segment_slug, segment_label)
select p.id, v.category_slug, v.seller_category_slug, v.segment_slug, v.segment_label
from (values
  -- === Zellbury - affordable ethnic/western fashion ======================
  ('zellbury', 'women',          'fashion-and-apparel', 'womenswear',  'Womenswear'),
  ('zellbury', 'men',            'fashion-and-apparel', 'menswear',    'Menswear'),
  ('zellbury', 'ready-to-wear',  'fashion-and-apparel', 'womenswear',  'Womenswear'),
  ('zellbury', 'women-bags',     'fashion-and-apparel', 'accessories', 'Accessories'),

  -- === Bonanza Satrangi - women's pret/unstitched, fragrances ============
  ('bonanzasatrangi', 'new-in-unstitched', 'fashion-and-apparel',      'womenswear', 'Womenswear'),
  ('bonanzasatrangi', 'mens',              'fashion-and-apparel',      'menswear',   'Menswear'),
  ('bonanzasatrangi', 'fragrances',        'beauty-and-personal-care', 'beauty',     'Beauty & Cosmetics'),
  ('bonanzasatrangi', 'ready-to-wear',     'fashion-and-apparel',      'womenswear', 'Womenswear'),

  -- === Beechtree - women's fashion ========================================
  ('beechtree', 'best-seller-pret',        'fashion-and-apparel', 'womenswear',  'Womenswear'),
  ('beechtree', 'embroidered-pret',        'fashion-and-apparel', 'womenswear',  'Womenswear'),
  ('beechtree', 'accessories',             'fashion-and-apparel', 'accessories', 'Accessories'),
  ('beechtree', 'embroidered-pret-2-piece','fashion-and-apparel', 'womenswear',  'Womenswear'),

  -- === Nishat Linen - fashion + home linen ================================
  ('nishatlinen', 'accessories',            'fashion-and-apparel', 'accessories', 'Accessories'),
  ('nishatlinen', 'embroidered-pret',       'fashion-and-apparel', 'womenswear',  'Womenswear'),
  ('nishatlinen', 'embroidered-unstitched', 'fashion-and-apparel', 'womenswear',  'Womenswear'),
  ('nishatlinen', 'bags-summer-2025',       'fashion-and-apparel', 'accessories', 'Accessories'),

  -- === Interwood - furniture (home + office) ==============================
  ('interwood', 'living',    'home-and-kitchen', 'furniture', 'Furniture'),
  ('interwood', 'bedroom',   'home-and-kitchen', 'furniture', 'Furniture'),
  ('interwood', 'sofas-all', 'home-and-kitchen', 'furniture', 'Furniture'),
  ('interwood', 'office',    'home-and-kitchen', 'furniture', 'Furniture'),

  -- === Habitt - furniture + home decor, broad department store ===========
  ('habitt', 'craft-furniture',        'home-and-kitchen', 'furniture', 'Furniture'),
  ('habitt', 'all-dining-room-tables', 'home-and-kitchen', 'furniture', 'Furniture'),
  ('habitt', 'chester-sideboards',     'home-and-kitchen', 'furniture', 'Furniture'),
  ('habitt', 'blue-pottery',           'home-and-kitchen', 'home',      'Home & Living'),

  -- === Poshish - furniture =================================================
  ('poshish', 'living',  'home-and-kitchen', 'furniture', 'Furniture'),
  ('poshish', 'bedroom', 'home-and-kitchen', 'furniture', 'Furniture'),
  ('poshish', 'sofas',   'home-and-kitchen', 'furniture', 'Furniture'),
  ('poshish', 'dining',  'home-and-kitchen', 'furniture', 'Furniture'),

  -- === Woods.pk - furniture ================================================
  ('woods', 'double-beds-for-bedroom', 'home-and-kitchen', 'furniture', 'Furniture'),
  ('woods', 'workstations',            'home-and-kitchen', 'furniture', 'Furniture'),
  ('woods', 'wardrobes',               'home-and-kitchen', 'furniture', 'Furniture'),
  ('woods', 'computer-tables',         'home-and-kitchen', 'furniture', 'Furniture'),

  -- === ChenOne - apparel + home textile ====================================
  ('chenone', 'men-western-wear',          'fashion-and-apparel', 'menswear', 'Menswear'),
  ('chenone', 'men',                       'fashion-and-apparel', 'menswear', 'Menswear'),
  ('chenone', 'home-textile',              'home-and-kitchen',    'home',     'Home & Living'),
  ('chenone', 'chenone-home-accessories',  'home-and-kitchen',    'home',     'Home & Living'),

  -- === Petfit.pk - pet supplies (no dedicated seller category, see above) =
  ('petfit', 'cat',             'other', 'pets', 'Pet Supplies'),
  ('petfit', 'dog',             'other', 'pets', 'Pet Supplies'),
  ('petfit', 'pet-accessories', 'other', 'pets', 'Pet Supplies'),
  ('petfit', 'pet-grooming',    'other', 'pets', 'Pet Supplies'),

  -- === Luminaria.pk - home decor ===========================================
  ('luminaria', 'home-decor',         'home-and-kitchen', 'home', 'Home & Living'),
  ('luminaria', 'sculptures',         'home-and-kitchen', 'home', 'Home & Living'),
  ('luminaria', 'vases-urns',         'home-and-kitchen', 'home', 'Home & Living'),
  ('luminaria', 'bathroom-essentials','home-and-kitchen', 'home', 'Home & Living')
) as v(platform_slug, category_slug, seller_category_slug, segment_slug, segment_label)
join market_platforms p on p.slug = v.platform_slug
on conflict (platform_id, category_slug, seller_category_slug) do update
  set segment_slug = excluded.segment_slug,
      segment_label = excluded.segment_label;
