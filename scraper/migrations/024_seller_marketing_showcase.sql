-- Backs two things the public marketing homepage's new "company slider"
-- needs, neither of which existed before:
--
--   1. Real signed-up sellers who explicitly consent to showing their logo
--      to anonymous website visitors. This is a DIFFERENT consent scope from
--      seller_public_profile.is_public, which only ever controlled peer
--      (other-seller) visibility inside the dashboard - see
--      seller_public_profiles_view below. A seller opting into category
--      benchmarks has not thereby agreed to have their name/logo shown to
--      every anonymous visitor on ryvl's homepage, so this gets its own
--      column and its own opt-in switch in Settings, not a reuse of
--      is_public.
--   2. Top brands actually present in scraped market_products, for the
--      "brands we track pricing for" side of the same slider.
--
-- Apply manually via the Supabase SQL Editor, same convention as 001-023.

-- ---------------------------------------------------------------------------
-- 1. Seller showcase opt-in
-- ---------------------------------------------------------------------------

alter table seller_public_profile
  add column if not exists website text,
  add column if not exists show_on_marketing_site boolean not null default false;

-- Public-facing showcase view: intentionally narrower than
-- seller_public_profiles_view (012) - that view exposes benchmark fields to
-- *authenticated peers only*. This one is read by the anonymous marketing
-- homepage, so it exposes only a name and a domain, and only for rows where
-- the seller flipped show_on_marketing_site on AND supplied a website.
-- Definer semantics (view owned by the migration role, same as the existing
-- peer view) let it read past seller_public_profile's owner-only RLS while
-- still only ever returning the opted-in rows below - nothing else on
-- sellers/seller_public_profile is reachable through it.
create or replace view seller_marketing_showcase as
select
  sp.seller_id,
  coalesce(nullif(sp.display_name, ''), s.business_name) as name,
  sp.website as domain
from seller_public_profile sp
join sellers s on s.id = sp.seller_id
where sp.show_on_marketing_site = true
  and sp.website is not null
  and sp.website <> '';

-- anon (not just authenticated): this is read from the public homepage,
-- which has no session at all.
grant select on seller_marketing_showcase to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Top scraped brands
-- ---------------------------------------------------------------------------

-- security invoker (same convention as 021/022's aggregate functions): runs
-- as the calling role, so it's naturally anon-safe since market_products has
-- no RLS enabled on it (it's shared competitor data, not seller-private).
create or replace function top_market_brands(p_limit int default 12)
returns table (brand text, product_count bigint)
language sql
stable
security invoker
as $$
  select brand, count(*)::bigint as product_count
  from market_products
  where is_active = true
    and brand is not null
    and btrim(brand) <> ''
  group by brand
  order by count(*) desc, brand asc
  limit greatest(p_limit, 0);
$$;
