-- Adds Sapphireonline.pk as a tracked platform. This is a single brand's own
-- store (Salesforce Commerce Cloud), not a marketplace - tracked as a
-- brand-monitoring source rather than a price-comparison one. Plain HTTP,
-- no bot protection - see market-scraper/src/sources/sapphireonline.ts.
-- Apply manually against Supabase, same convention as 001-005.

insert into market_platforms (slug, name, base_url)
values ('sapphireonline', 'Sapphire Online', 'https://pk.sapphireonline.pk')
on conflict (slug) do nothing;
