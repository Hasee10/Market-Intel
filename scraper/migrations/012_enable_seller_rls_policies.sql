-- RLS for the seller platform tables created in 011. This is the actual
-- enforcement of the private/peer-visible boundary described there - the
-- table design alone is just documentation until these policies exist.
--
-- Pattern used throughout: every private table is scoped to
--   seller_id in (select id from sellers where user_id = auth.uid())
-- so a seller only ever sees their own rows, regardless of what the
-- frontend requests. domain_benchmarks is the opposite: readable by any
-- authenticated seller, writable only by the service role (the aggregation
-- job), since it's already anonymized.
-- Apply manually against Supabase, same convention as 001-011.

alter table sellers enable row level security;
alter table seller_categories enable row level security;
alter table seller_domains enable row level security;
alter table seller_products enable row level security;
alter table seller_customers enable row level security;
alter table seller_orders enable row level security;
alter table seller_churn_snapshots enable row level security;
alter table seller_public_profile enable row level security;
alter table domain_benchmarks enable row level security;

-- sellers: a seller can only see/manage their own account row.
create policy sellers_select_own on sellers
  for select using (user_id = auth.uid());
create policy sellers_insert_own on sellers
  for insert with check (user_id = auth.uid());
create policy sellers_update_own on sellers
  for update using (user_id = auth.uid());

-- seller_categories: shared reference data, readable by any authenticated
-- seller (needed for onboarding/category pickers). No insert/update policy
-- for authenticated users - only the service role can maintain this list.
create policy seller_categories_select_all on seller_categories
  for select to authenticated using (true);

-- seller_domains / seller_products / seller_customers / seller_orders /
-- seller_churn_snapshots: strictly owner-only on every operation.
create policy seller_domains_owner_all on seller_domains
  for all using (
    seller_id in (select id from sellers where user_id = auth.uid())
  ) with check (
    seller_id in (select id from sellers where user_id = auth.uid())
  );

create policy seller_products_owner_all on seller_products
  for all using (
    seller_id in (select id from sellers where user_id = auth.uid())
  ) with check (
    seller_id in (select id from sellers where user_id = auth.uid())
  );

create policy seller_customers_owner_all on seller_customers
  for all using (
    seller_id in (select id from sellers where user_id = auth.uid())
  ) with check (
    seller_id in (select id from sellers where user_id = auth.uid())
  );

create policy seller_orders_owner_all on seller_orders
  for all using (
    seller_id in (select id from sellers where user_id = auth.uid())
  ) with check (
    seller_id in (select id from sellers where user_id = auth.uid())
  );

create policy seller_churn_snapshots_owner_all on seller_churn_snapshots
  for all using (
    seller_id in (select id from sellers where user_id = auth.uid())
  ) with check (
    seller_id in (select id from sellers where user_id = auth.uid())
  );

-- seller_public_profile: the base table is owner-only, same as the private
-- tables above - peers never query this table directly. Peer visibility is
-- granted only through the view below, which exposes just the opted-in
-- boolean/display fields and nothing else.
create policy seller_public_profile_owner_all on seller_public_profile
  for all using (
    seller_id in (select id from sellers where user_id = auth.uid())
  ) with check (
    seller_id in (select id from sellers where user_id = auth.uid())
  );

-- Peer-facing view: only exists to carve out the narrow, opted-in public
-- surface from seller_public_profile. security_invoker = off (default,
-- i.e. security definer semantics via the view owner) so it can read past
-- the owner-only RLS above, but it only ever returns rows where the seller
-- has flipped is_public on, and only the columns listed here - nothing from
-- seller_products/orders/customers/churn_snapshots is reachable this way.
create or replace view seller_public_profiles_view as
select
  sp.seller_id,
  sp.display_name,
  sp.show_price_position,
  sp.show_rating,
  sp.show_category_rank,
  sd.category_id
from seller_public_profile sp
join seller_domains sd on sd.seller_id = sp.seller_id
where sp.is_public = true;

grant select on seller_public_profiles_view to authenticated;

-- domain_benchmarks: readable by any authenticated seller (it's already an
-- anonymized aggregate - that's the whole point of peer benchmarking). No
-- insert/update/delete policy for authenticated/anon - only the service
-- role (used by the backend aggregation job, which bypasses RLS entirely)
-- can write to this table.
create policy domain_benchmarks_select_all on domain_benchmarks
  for select to authenticated using (true);
