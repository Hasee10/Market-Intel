-- Track products/listings that disappear from a source between runs (sold
-- out, delisted, category reshuffled) instead of leaving them silently
-- stale with an old last_seen_at and no way to tell "gone" from "just not
-- rescanned yet". Apply manually against Supabase, same convention as 001-007.

alter table market_products add column if not exists is_active boolean not null default true;

create index if not exists market_products_platform_active_idx
  on market_products (platform_id, is_active);

-- market_classified_listings already has a `status` column (default
-- 'active') from migration 007 - db.ts now also transitions it to
-- 'inactive' for listings not seen in a run, so no schema change needed
-- there, just an index to make the staleness UPDATE cheap.
create index if not exists market_classified_listings_platform_status_idx
  on market_classified_listings (platform_id, status);
