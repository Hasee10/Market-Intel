-- Adds iShopping.pk as a tracked platform. This one is Cloudflare-protected
-- (Cf-Mitigated: challenge on plain HTTP) and is scraped via CloakBrowser -
-- see market-scraper/src/sources/ishopping.ts.
-- Apply manually against Supabase, same convention as 001/002/003.

insert into market_platforms (slug, name, base_url)
values ('ishopping', 'iShopping.pk', 'https://www.ishopping.pk')
on conflict (slug) do nothing;
