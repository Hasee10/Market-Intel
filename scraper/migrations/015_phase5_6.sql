-- Phase 5 (monetization/growth) + Phase 6 (trust/compliance) schema changes.
-- Apply manually against Supabase, same convention as 001-014.

-- ===== Decision: drop the dormant market_accounts buyer-side schema =====
-- new_implementation_doc.md flagged this as an open decision ("resurrect as
-- a separate paid buyer-side product, or drop"). Call made here: DROP. It's
-- always had zero rows (bcrypt-based auth from the original JobLo-era plan,
-- never wired to anything this platform actually uses), and
-- market_watchlists/market_watchlist_items/market_alerts_sent were already
-- superseded by the seller-scoped seller_watchlists/seller_watchlist_items/
-- seller_price_alerts in 014. Keeping unused schema around is tech debt, not
-- optionality - if a buyer-side "market analyst" product is ever built, it
-- deserves a fresh design against real requirements, not a resurrected
-- placeholder nobody has used.
drop table if exists market_alerts_sent;
drop table if exists market_watchlist_items;
drop table if exists market_watchlists;
drop table if exists market_accounts;

-- ===== Referral mechanic =====
-- Ties growth to the same lever as benchmark data quality: more sellers in
-- a category means domain_benchmarks clears its minimum-sample-size floor
-- (see benchmarks-job.ts) sooner. referral_code is generated once per
-- seller (see lib/market-intel/referrals.ts) and shared as a signup link;
-- seller_referrals tracks clicks/signups against it.
alter table sellers add column if not exists referral_code text unique;

create table if not exists seller_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_seller_id uuid not null references sellers(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending', 'joined')),
  joined_seller_id uuid references sellers(id) on delete set null,
  created_at timestamptz not null default now(),
  joined_at timestamptz
);

create index if not exists seller_referrals_referrer_idx on seller_referrals (referrer_seller_id);
create index if not exists seller_referrals_code_idx on seller_referrals (referral_code);

alter table seller_referrals enable row level security;

create policy seller_referrals_owner_all on seller_referrals
  for all using (
    referrer_seller_id in (select id from sellers where user_id = auth.uid())
  ) with check (
    referrer_seller_id in (select id from sellers where user_id = auth.uid())
  );

-- ===== Scraper health (Phase 6 trust/compliance) =====
-- The scraper's run.ts already prints a per-platform summary
-- (productCount/error) to GitHub Actions logs every run - that data just
-- never persisted anywhere queryable. This table backs an internal health
-- dashboard tracking failure rate per source over time (iShopping/Goto
-- already have Cloudflare/TLS friction per new_implementation_doc.md Phase 6
-- - this is what lets that be monitored instead of anecdotal).
create table if not exists scraper_runs (
  id uuid primary key default gen_random_uuid(),
  platform_slug text not null,
  product_count integer not null default 0,
  error text,
  run_at timestamptz not null default now()
);

create index if not exists scraper_runs_platform_run_idx on scraper_runs (platform_slug, run_at desc);

-- No RLS: scraper_runs is internal operational telemetry (which sources are
-- healthy), not seller data - readable by any authenticated seller for the
-- internal health page (no per-row ownership concept applies here), written
-- only by the scraper's service-role key.
alter table scraper_runs enable row level security;

create policy scraper_runs_select_all on scraper_runs
  for select to authenticated using (true);
