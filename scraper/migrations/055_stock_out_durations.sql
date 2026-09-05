-- How long a currently out-of-stock product has actually been out - not
-- just when it was last scraped.
--
-- getStockOuts already exists and orders by market_products.last_seen_at,
-- which is bumped on EVERY scrape regardless of stock status - it says how
-- fresh the row is, nothing about how long in_stock has been false. A
-- listing scraped an hour ago that just went out today and one that has
-- been out for three weeks look identical on that column, and the whole
-- point of a stock-out list - "pick up the slack while they can't fulfil" -
-- needs exactly the distinction it cannot make.
--
-- market_price_history already carries in_stock per observation
-- (migration 001), so the answer is in the data already collected; nothing
-- surfaced it until now.
--
-- Per-product lateral subqueries against the (product_id, recorded_at desc)
-- index already indexed for this table (021), not a join + group by over
-- the whole history: each subquery is an index range scan bounded by
-- LIMIT 1 or a single MIN(), so cost scales with the product list this is
-- called on (bounded by the caller, currently the displayed page of
-- stock-outs) rather than with market_price_history's own size - the
-- fastest-growing table in the schema, per every other migration that
-- touches it.
--
-- last_confirmed_in_stock_at is null when the product has never been seen
-- in stock across our whole recorded history for it - which the app must
-- treat as a floor ("out for at least this long, since our records begin"),
-- not a confirmed transition, since we may simply not have scraped it while
-- it was still in stock.
--
-- Apply manually via the Supabase SQL Editor, after 001.

create or replace function market_stock_out_durations(p_product_ids uuid[])
returns table (
  product_id uuid,
  last_confirmed_in_stock_at timestamptz,
  earliest_observed_at timestamptz
)
language sql
stable
security invoker
as $$
  select
    pid.product_id,
    (
      select h.recorded_at
      from market_price_history h
      where h.product_id = pid.product_id
        and h.in_stock = true
      order by h.recorded_at desc
      limit 1
    ) as last_confirmed_in_stock_at,
    (
      select min(h.recorded_at)
      from market_price_history h
      where h.product_id = pid.product_id
    ) as earliest_observed_at
  from unnest(p_product_ids) as pid(product_id);
$$;
