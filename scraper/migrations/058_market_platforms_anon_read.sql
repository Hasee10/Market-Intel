-- Extends market_platforms' read policy to anon, same precedent as
-- market_products in 042 - "gets an additional anon grant specifically
-- because top_market_brands() (024) is security invoker and is called from
-- the public marketing homepage via the anon client... without this grant,
-- enabling RLS here would silently break that RPC for every logged-out
-- visitor." That reasoning now applies to market_platforms too:
-- showcase.ts's fetchShowcaseBrands reads market_platforms(name, base_url)
-- directly from the anon-context homepage, to resolve a "brand" that is
-- really a single-retailer platform's own name (Shopify defaults a
-- product's vendor field to the store name - see
-- scraper/src/sources/shopify-source.ts) to that platform's own known
-- domain, instead of guessing via logo.dev's global Brand Search, which has
-- no reason to know a small Pakistani storefront by name.
--
-- Nothing sensitive here - platform name and base_url are already public
-- (the marketing homepage's own MarketplaceLogoSlider shows the same
-- domains today via a hardcoded list in lib/marketplaces.ts). This just
-- lets the same information be read from the table instead of duplicated
-- by hand a second time.
--
-- Apply manually via the Supabase SQL Editor, after 042.

do $$
begin
  if to_regclass('public.market_platforms') is not null then
    execute 'drop policy if exists market_platforms_select_authenticated on market_platforms';
    execute 'drop policy if exists market_platforms_select_anon on market_platforms';
    execute 'create policy market_platforms_select_anon on market_platforms for select to anon, authenticated using (true)';
  else
    raise notice 'Skipped market_platforms - table does not exist yet.';
  end if;
end $$;
