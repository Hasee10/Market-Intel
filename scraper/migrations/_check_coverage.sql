-- Which seller categories actually have scraped market data?
--
-- READ-ONLY. Every statement is a SELECT; nothing is created, altered or
-- dropped. Safe to run against production.
--
-- Why this exists: ROADMAP.md's "2 of 12 categories have any scraped rows"
-- is dated 2026-08-03 and PREDATES the Daraz rollout that was expected to
-- close most of that gap. Several planning decisions hang off that number
-- (D4 retailer coverage vs. SELLER_TRACKED_COMPETITORS.md tier 1), so it
-- needs re-measuring rather than re-quoting.
--
-- Coverage is counted through market_category_map, NOT by matching
-- category_slug directly. That mapping table IS the market definition
-- (migration 020) - a product only counts toward a seller category if the
-- taxonomy says it belongs there. Counting raw slugs would overstate
-- coverage by including scraped nodes nobody has mapped yet.

-- ---------------------------------------------------------------------------
-- 1. THE HEADLINE NUMBER: rows per seller category
-- ---------------------------------------------------------------------------
-- Read this one first. Any category showing 0 is a category where the whole
-- product renders empty states.

select
  sc.slug                                   as seller_category,
  sc.name,
  count(distinct mp.id)                     as products,
  count(distinct mp.id) filter (where mp.is_active)      as active_products,
  count(distinct mp.platform_id)            as platforms,
  count(distinct mcm.segment_slug)          as mapped_segments,
  round(avg(mp.price) filter (where mp.price > 0), 0)    as avg_price,
  max(mp.last_seen_at)                      as last_scraped
from seller_categories sc
left join market_category_map mcm
  on mcm.seller_category_slug = sc.slug
left join market_products mp
  on mp.platform_id = mcm.platform_id
 and mp.category_slug = mcm.category_slug
group by sc.slug, sc.name
order by products desc, sc.slug;

-- ---------------------------------------------------------------------------
-- 2. Which platform is carrying each category?
-- ---------------------------------------------------------------------------
-- Concentration matters as much as the count: a category served by exactly
-- one source is one block away from being empty. That is precisely how the
-- ten OLX-only categories went to zero.

select
  sc.slug        as seller_category,
  pl.slug        as platform,
  count(distinct mp.id) as products,
  max(mp.last_seen_at)  as last_scraped
from seller_categories sc
join market_category_map mcm on mcm.seller_category_slug = sc.slug
join market_platforms pl     on pl.id = mcm.platform_id
left join market_products mp
  on mp.platform_id = mcm.platform_id
 and mp.category_slug = mcm.category_slug
group by sc.slug, pl.slug
having count(distinct mp.id) > 0
order by sc.slug, products desc;

-- ---------------------------------------------------------------------------
-- 3. Single-source categories - the fragile ones
-- ---------------------------------------------------------------------------

select seller_category, platforms_with_data
from (
  select sc.slug as seller_category,
         count(distinct mp.platform_id) as platforms_with_data
  from seller_categories sc
  join market_category_map mcm on mcm.seller_category_slug = sc.slug
  join market_products mp
    on mp.platform_id = mcm.platform_id
   and mp.category_slug = mcm.category_slug
  group by sc.slug
) t
where platforms_with_data = 1
order by seller_category;

-- ---------------------------------------------------------------------------
-- 4. Staleness - is the data current, or just present?
-- ---------------------------------------------------------------------------
-- A category with rows last seen six weeks ago is not covered in any useful
-- sense. The scraper runs on a 2-day cadence, so anything past ~4 days is
-- a source that has quietly stopped returning rows (the OLX failure mode:
-- it recorded product_count 0 with error null for three runs before anyone
-- noticed).

select
  pl.slug                                    as platform,
  count(*)                                   as products,
  max(mp.last_seen_at)                       as last_seen,
  now() - max(mp.last_seen_at)               as age
from market_products mp
join market_platforms pl on pl.id = mp.platform_id
group by pl.slug
order by max(mp.last_seen_at) asc nulls first;

-- ---------------------------------------------------------------------------
-- 5. Unmapped scraped nodes - coverage we already have but cannot use
-- ---------------------------------------------------------------------------
-- Products whose (platform, category_slug) has no row in market_category_map
-- are invisible to every seller-facing query. If a category reads as empty
-- in query 1 but rows show up here, the fix is a taxonomy INSERT, not a
-- scraper change - much cheaper than adding a retailer.

select
  pl.slug                as platform,
  mp.category_slug,
  count(*)               as products,
  max(mp.last_seen_at)   as last_seen
from market_products mp
join market_platforms pl on pl.id = mp.platform_id
left join market_category_map mcm
  on mcm.platform_id = mp.platform_id
 and mcm.category_slug = mp.category_slug
where mcm.id is null
group by pl.slug, mp.category_slug
order by products desc;

-- ---------------------------------------------------------------------------
-- How to read the result
-- ---------------------------------------------------------------------------
-- Query 1 shows >= 8 categories with data  -> the coverage crisis is over.
--   D4 drops in priority; build tier 1 of SELLER_TRACKED_COMPETITORS.md on
--   top of real data.
-- Query 1 still shows 2-3 categories       -> coverage is still THE
--   constraint. Tier 1 (nominate a merchant we already scrape) only helps
--   inside covered categories, so weigh it against D4 honestly.
-- Query 5 returns a lot                    -> cheapest win available; the
--   data is already scraped and just needs mapping.
