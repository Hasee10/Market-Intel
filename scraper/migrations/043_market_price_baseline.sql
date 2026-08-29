-- Fixes detectCompetitorPriceAnomalies (anomalies.ts) contradicting its own
-- neighbouring file's documented rule (code audit, 2026-08-29).
--
-- market-insights.ts's getPriceTrend() has a comment describing exactly this
-- pattern as already fixed: "it used to select every matching product id,
-- then pass that entire array back in as an .in() filter on
-- market_price_history - a request whose URL length grew with the size of
-- the seller's market, over the fastest-growing table in the schema." That
-- fix was never applied to anomalies.ts, which still does precisely that:
-- selects every active in-scope product with no limit, passes every id into
-- `.in('product_id', …)` against market_price_history, and orders the
-- *entire* result set with no limit before folding it into a JS Map to find
-- each product's oldest price in the window.
--
-- Beyond cost, this can be silently wrong: PostgREST applies a default row
-- ceiling, so once the history result exceeds it the map is built from a
-- truncated set and anomalies get computed against whichever products
-- happened to fit - no error surfaces, the failure mode is wrong findings,
-- not a slow page.
--
-- This function replaces both of those queries with one indexed lookup: for
-- every in-scope product, the single most recent price observation at or
-- before the cutoff (`distinct on` ordered by recorded_at desc) - exactly
-- the "oldest price inside the window" value the old code computed by
-- pulling every row and keeping the first one seen per product.
--
-- Apply manually via the Supabase SQL Editor, after 026 - reuses
-- market_price_history_product_recorded_idx (product_id, recorded_at desc),
-- already created there for exactly this "latest points for product X"
-- access pattern, so no new index is needed here.

create or replace function market_scope_price_baseline(
  p_category_slugs text[],
  p_platform_ids uuid[],
  p_cutoff timestamptz
) returns table (
  product_id uuid,
  baseline_price numeric
)
language sql
stable
security invoker
as $$
  select distinct on (h.product_id)
    h.product_id,
    h.price
  from market_price_history h
  join market_products p on p.id = h.product_id
  where p.is_active
    and p.category_slug = any(p_category_slugs)
    and p.platform_id = any(p_platform_ids)
    and h.recorded_at <= p_cutoff
    and h.price is not null
  order by h.product_id, h.recorded_at desc;
$$;
