-- Adds Shophive.com as a tracked platform (in-house Cheerio scraper, same
-- tier of difficulty as PriceOye/Telemart - see market-scraper/src/sources/shophive.ts).
-- Apply manually against Supabase, same convention as 001/002.

insert into market_platforms (slug, name, base_url)
values ('shophive', 'Shophive', 'https://www.shophive.com')
on conflict (slug) do nothing;
