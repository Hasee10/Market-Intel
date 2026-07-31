-- Products got a currency column (016) but orders/customers/reporting never
-- followed - seller_orders.currency already existed but no UI ever set it
-- (always silently defaulted to 'PKR'), seller_customers had no currency at
-- all, and every aggregation (dashboard stats, PPTX report, customer LTV)
-- just summed raw numbers across currencies as if they were the same unit.
-- This adds what's needed to convert everything into one consistent number
-- per seller before aggregating. Apply manually against Supabase, same
-- convention as 001-016.

-- A seller's single "home" currency for aggregate reporting (dashboard
-- totals, PPTX report) - individual orders/products can still be in other
-- currencies, they just get converted into this one before summing.
alter table sellers add column if not exists reporting_currency text not null default 'PKR';

-- Was silently ambiguous - a manually-entered totalSpent had no stated unit.
alter table seller_customers add column if not exists currency text not null default 'PKR';

-- Daily exchange-rate snapshot, base-currency-relative (base is always
-- 'USD' - simplest way to convert any-to-any via a single division/multiply
-- through USD, rather than storing every currency pair directly). Refreshed
-- once a day by /api/cron/fx-rates; upserts on (base_currency, quote_currency,
-- rate_date) so re-running the same day's job is a no-op update, not a
-- duplicate row.
create table if not exists fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null default 'USD',
  quote_currency text not null,
  rate numeric(18, 8) not null,
  rate_date date not null default current_date,
  fetched_at timestamptz not null default now(),
  unique (base_currency, quote_currency, rate_date)
);

create index if not exists fx_rates_lookup_idx
  on fx_rates (base_currency, rate_date desc);

-- No RLS: fx_rates is global reference data (same rates apply to every
-- seller), not seller-owned - readable by any authenticated seller,
-- writable only by the service role (the cron job).
alter table fx_rates enable row level security;

drop policy if exists fx_rates_select_all on fx_rates;
create policy fx_rates_select_all on fx_rates
  for select to authenticated using (true);
