-- Multi-photo gallery support. Only Telemart's source currently populates
-- this (its Shopify /products.json endpoint returns a full images[] array
-- for free) - other platforms still only have image_url. Apply manually
-- against Supabase, same convention as 001-009.

alter table market_products add column if not exists gallery_urls text[];
