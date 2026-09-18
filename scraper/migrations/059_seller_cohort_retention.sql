-- Cohort retention for a seller's own customers.
--
-- "Customer repeat orders" on the product notes (2026-09-18) asks a
-- question the existing repeat-purchase rate (seller_churn_snapshots,
-- migration 015) does not answer: not "what share of customers ever came
-- back" but "of the customers I gained in a given month, how many were
-- still ordering one, two, three months later". That is a cohort table,
-- and it is the standard way to see whether retention is improving or
-- decaying across acquisition months.
--
-- Cohort = the calendar month of seller_customers.first_order_at. A
-- customer is retained in month N if they have at least one seller_orders
-- row dated in cohort month + N. Month 0 is therefore always 100% by
-- construction and is returned so the client can render the diagonal.
--
-- Uses only tables that exist today - no line items, no new columns. The
-- same two tables getSellerKpiTotals reads. security invoker, so the
-- caller's RLS applies: a seller can only ever see their own cohorts.
--
-- Bounded to p_months back and forward so the result stays small: 6
-- cohorts x 7 offsets = at most 42 rows. Customers with no first_order_at
-- (imported without dates) are excluded rather than bucketed into a fake
-- cohort.
--
-- Apply manually via the Supabase SQL Editor. Depends on nothing new.

create or replace function seller_cohort_retention(
  p_seller_id uuid,
  p_months integer default 6
) returns table (
  cohort_month date,
  month_offset integer,
  customers bigint,
  retained bigint,
  retention_rate numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with cohorts as (
    select
      c.id as customer_id,
      date_trunc('month', c.first_order_at)::date as cohort_month
    from seller_customers c
    where c.seller_id = p_seller_id
      and c.first_order_at is not null
      and c.first_order_at >= date_trunc('month', now()) - make_interval(months => p_months - 1)
  ),
  cohort_sizes as (
    select cohort_month, count(*)::bigint as customers
    from cohorts
    group by cohort_month
  ),
  activity as (
    select distinct
      co.cohort_month,
      co.customer_id,
      (
        (extract(year from date_trunc('month', o.order_date)) - extract(year from co.cohort_month)) * 12
        + (extract(month from date_trunc('month', o.order_date)) - extract(month from co.cohort_month))
      )::integer as month_offset
    from cohorts co
    join seller_orders o
      on o.customer_id = co.customer_id
     and o.seller_id = p_seller_id
     and o.order_date >= co.cohort_month
  ),
  retained_counts as (
    select cohort_month, month_offset, count(*)::bigint as retained
    from activity
    where month_offset between 0 and p_months
    group by cohort_month, month_offset
  )
  select
    s.cohort_month,
    r.month_offset,
    s.customers,
    r.retained,
    round((r.retained::numeric / nullif(s.customers, 0)) * 100, 1) as retention_rate
  from cohort_sizes s
  join retained_counts r on r.cohort_month = s.cohort_month
  order by s.cohort_month, r.month_offset;
$$;

comment on function seller_cohort_retention(uuid, integer) is
  'Monthly cohort retention for one seller: for each acquisition month (first_order_at), the share of those customers with at least one order N months later. Reads seller_customers and seller_orders under the caller''s RLS.';
