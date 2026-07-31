-- Market-intel pricing (category-pricing.ts, product-matching.ts,
-- pricing-recommendation.ts) compares scraped competitor prices (native
-- currency of the scraped source, e.g. market_products.currency) against a
-- seller's own prices with no conversion - correct today only because every
-- scraper targets PKR sites and every seller has so far been PKR. Adds the
-- rate table and per-seller reporting currency needed to convert scraped
-- prices before comparing/displaying them.
-- Apply manually against Supabase, same convention as 001-016.

create table if not exists fx_rates (
  id uuid primary key default gen_random_uuid(),
  currency text not null,
  rate_to_pkr numeric(18, 6) not null,
  as_of date not null,
  created_at timestamptz not null default now(),
  unique (currency, as_of)
);

create index if not exists fx_rates_currency_as_of_idx on fx_rates (currency, as_of desc);

-- PKR is the base currency (every scraper's native currency today) - seed it
-- as an identity rate so lookups never need a special case for PKR.
insert into fx_rates (currency, rate_to_pkr, as_of)
values ('PKR', 1, current_date)
on conflict (currency, as_of) do nothing;

alter table sellers add column if not exists reporting_currency text not null default 'PKR';
