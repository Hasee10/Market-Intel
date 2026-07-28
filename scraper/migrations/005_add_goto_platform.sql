-- Adds Goto.com.pk as a tracked platform. Scraped via CloakBrowser with
-- ignoreHTTPSErrors (the site's TLS cert is expired) - see
-- market-scraper/src/sources/goto.ts. Note: phones/laptops/appliances
-- categories are nearly empty on this site; GOTO_CATEGORIES sticks to
-- categories with real inventory (computing-gaming, fashion).
-- Apply manually against Supabase, same convention as 001/002/003/004.

insert into market_platforms (slug, name, base_url)
values ('goto', 'Goto.com.pk', 'https://www.goto.com.pk')
on conflict (slug) do nothing;
