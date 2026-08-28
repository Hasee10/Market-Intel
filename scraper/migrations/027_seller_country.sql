-- ROADMAP: country-aware product catalogue. The seller product catalogue
-- (manual add/edit + CSV bulk import) was Pakistan-shaped by default: SKU
-- was force-required in the CSV import path even though this column has
-- always been nullable here, and every imported row landed on the
-- hardcoded 'PKR' default regardless of the seller's own currency. This
-- migration adds the one new column that lets the app stop forcing fields
-- a seller's market doesn't use, without inventing a rearchitecture.
--
-- Apply manually via the Supabase SQL Editor, after 026.

-- Defaults every existing seller to 'PK' - preserves current behaviour
-- exactly (this is the only country the product has ever supported), so
-- this migration changes zero live behaviour on its own until sellers
-- start setting it from Settings/onboarding.
alter table sellers add column if not exists country text not null default 'PK';

-- Lets a CSV row with no SKU still be idempotent on re-import. Today a
-- SKU-less row has no uniqueness constraint at all (seller_products_seller
-- _sku_idx is `where sku is not null`), so re-uploading the same file would
-- silently create duplicate products every time. A separate nullable
-- column, not reusing sku itself, so the Products table's existing
-- `product.sku || 'N/A'` display never shows a synthetic value to the
-- seller - this is purely a de-dup key for the import pipeline.
alter table seller_products add column if not exists import_key text;

create unique index if not exists seller_products_seller_import_key_idx
  on seller_products (seller_id, import_key) where import_key is not null;
