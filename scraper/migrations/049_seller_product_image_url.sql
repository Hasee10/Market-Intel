-- Adds an optional image to a seller's own product catalogue.
--
-- seller_products has never had one (see 011), so the Products table and
-- grid cards fall back to a category-derived tile (ProductThumb). That
-- fallback stays: this column is nullable and nothing requires it, so a
-- seller who never sets an image sees exactly what they see today.
--
-- Deliberately a URL rather than a stored file. Sellers importing a
-- catalogue by CSV already have image URLs from their store platform, and
-- accepting uploads would mean a storage bucket, size/type validation, and
-- a deletion path - real scope that buys nothing until someone actually
-- asks to upload rather than paste.
--
-- No index: this is only ever selected alongside its row, never filtered on.
--
-- Apply manually via the Supabase SQL Editor, same convention as 001-048.

alter table seller_products
  add column if not exists image_url text;

comment on column seller_products.image_url is
  'Optional product image URL, supplied by the seller (paste or CSV import). Null falls back to the category tile in the UI.';
