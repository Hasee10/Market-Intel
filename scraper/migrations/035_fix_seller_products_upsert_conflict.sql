-- Fixes a bug that has broken bulk CSV product import for every seller:
-- api/products/bulk-import/route.ts does
--   .upsert(rows, { onConflict: 'seller_id,sku' })
--   .upsert(rows, { onConflict: 'seller_id,import_key' })
-- but the two indexes those rely on (011_create_seller_platform_tables.sql,
-- 027_seller_country.sql) are PARTIAL:
--   ... on seller_products (seller_id, sku) where sku is not null;
--   ... on seller_products (seller_id, import_key) where import_key is not null;
--
-- Postgres's ON CONFLICT (col_list) can only match a plain unique index
-- unless the exact same WHERE predicate is also stated in the ON CONFLICT
-- clause itself - and the Supabase JS client's upsert({ onConflict }) has no
-- way to pass a partial-index predicate through. The result is exactly the
-- error seen live: "there is no unique or exclusion constraint matching the
-- ON CONFLICT specification" - on every single bulk import, for every
-- seller, since 027_seller_country.sql added the import_key path (or since
-- 011 if a seller's rows all carried a SKU).
--
-- Fix: drop the WHERE clause, making both plain unique indexes. This is not
-- a behavior change - Postgres unique indexes already treat every NULL as
-- distinct from every other value by default (no NULLS NOT DISTINCT used
-- here), so rows with sku/import_key left null still never conflict with
-- each other, exactly as the partial version intended. The partial
-- predicate only ever saved a little index size; it never added a real
-- constraint the plain version doesn't already provide - and it's what
-- broke ON CONFLICT matching.
--
-- One-time risk to be aware of before applying: if any seller already has
-- two rows with the exact same (seller_id, sku) or (seller_id, import_key)
-- that only "worked" because the partial index silently excluded a
-- different NULL/non-NULL split, creating the plain index will fail loudly
-- with a duplicate-key error instead of applying silently - that would
-- surface real duplicate data worth knowing about, not something to
-- suppress.

drop index if exists seller_products_seller_sku_idx;
create unique index seller_products_seller_sku_idx
  on seller_products (seller_id, sku);

drop index if exists seller_products_seller_import_key_idx;
create unique index seller_products_seller_import_key_idx
  on seller_products (seller_id, import_key);
