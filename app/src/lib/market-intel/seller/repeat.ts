import 'server-only';

import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';
import { pctDiff } from '@/lib/market-intel/seller/overview';
import { createClient } from '@/lib/supabase/server';

// Repeat-customer figures from the seller's own orders and customers.
//
// The nightly churn snapshot (migration 015, surfaced on Customers) already
// carries a repeat-purchase rate: the share of all customers who have ever
// placed more than one order. That is a lifetime figure and it barely
// moves. The product notes ask for "customer repeat orders" as something a
// seller watches month to month, which needs two things the snapshot does
// not have: a windowed version (of the customers who ordered THIS month,
// how many had ordered before) and the revenue side (how much of this
// month's revenue came from returning customers). Those are here. The
// cohort table that goes with them is seller_cohort_retention (migration
// 059), wrapped below.
//
// Definitions, since "repeat" is used loosely elsewhere:
//
//   repeatShare        = customers with an order in the window who also had
//                        at least one order BEFORE the window, over all
//                        customers with an order in the window.
//   repeatRevenueShare = revenue in the window from those returning
//                        customers, over all revenue in the window.
//
// "Before the window" is judged on seller_customers.first_order_at, which
// bulk import and the order routes maintain, rather than by scanning every
// historical order - one indexed read instead of the whole order table.
// Guest orders (customer_id null) count toward revenue and order totals but
// can never be "repeat"; they are neither new nor returning, and are
// reported separately so the shares add up in front of a seller.
//
// Throws on a query error, same contract as the rest of seller/*.

export type RepeatStats = {
  periodDays: number;
  currency: string;
  customersOrdered: number;
  repeatCustomers: number;
  newCustomers: number;
  repeatShare: number;
  revenue: number;
  repeatRevenue: number;
  repeatRevenueShare: number;
  guestOrders: number;
  prior: {
    customersOrdered: number;
    repeatCustomers: number;
    repeatShare: number;
    repeatRevenueShare: number;
  };
  change: {
    repeatShare: number | null;
    repeatRevenueShare: number | null;
  };
};

export type CohortRow = {
  cohortMonth: string;
  monthOffset: number;
  customers: number;
  retained: number;
  retentionRate: number;
};

type OrderRow = {
  customer_id: string | null;
  total_amount: number | string;
  currency: string;
  order_date: string;
};

type CustomerRow = { id: string; first_order_at: string | null };

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(1));
}

function summarise(
  orders: { customerId: string | null; amount: number }[],
  firstOrderAt: Map<string, Date | null>,
  windowStart: Date,
) {
  const byCustomer = new Map<string, number>();
  let guestOrders = 0;
  let revenue = 0;

  for (const o of orders) {
    revenue += o.amount;
    if (!o.customerId) {
      guestOrders += 1;
      continue;
    }
    byCustomer.set(o.customerId, (byCustomer.get(o.customerId) ?? 0) + o.amount);
  }

  let repeatCustomers = 0;
  let repeatRevenue = 0;
  for (const [customerId, amount] of byCustomer) {
    const first = firstOrderAt.get(customerId);
    if (first && first < windowStart) {
      repeatCustomers += 1;
      repeatRevenue += amount;
    }
  }

  const customersOrdered = byCustomer.size;
  return {
    customersOrdered,
    repeatCustomers,
    newCustomers: customersOrdered - repeatCustomers,
    repeatShare: pct(repeatCustomers, customersOrdered),
    revenue: Number(revenue.toFixed(2)),
    repeatRevenue: Number(repeatRevenue.toFixed(2)),
    repeatRevenueShare: pct(repeatRevenue, revenue),
    guestOrders,
  };
}

export async function getRepeatStats(
  sellerId: string,
  reportingCurrency: string,
  periodDays = 30,
): Promise<RepeatStats> {
  const supabase = await createClient();

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const periodStart = new Date(now.getTime() - periodDays * dayMs);
  const priorStart = new Date(now.getTime() - periodDays * 2 * dayMs);

  const [ordersRes, customersRes, fxRates] = await Promise.all([
    supabase
      .from('seller_orders')
      .select('customer_id, total_amount, currency, order_date')
      .eq('seller_id', sellerId)
      .gte('order_date', priorStart.toISOString()),
    supabase.from('seller_customers').select('id, first_order_at').eq('seller_id', sellerId),
    getLatestFxRates(),
  ]);

  if (ordersRes.error || customersRes.error) {
    throw new Error(ordersRes.error?.message || customersRes.error?.message || 'Unknown error');
  }

  const firstOrderAt = new Map<string, Date | null>(
    ((customersRes.data ?? []) as CustomerRow[]).map((c) => [
      c.id,
      c.first_order_at ? new Date(c.first_order_at) : null,
    ]),
  );

  const rows = ((ordersRes.data ?? []) as OrderRow[]).map((o) => ({
    customerId: o.customer_id,
    amount: convertCurrency(Number(o.total_amount), o.currency, reportingCurrency, fxRates),
    date: new Date(o.order_date),
  }));

  const current = summarise(
    rows.filter((o) => o.date >= periodStart),
    firstOrderAt,
    periodStart,
  );
  const priorFull = summarise(
    rows.filter((o) => o.date < periodStart),
    firstOrderAt,
    priorStart,
  );

  return {
    periodDays,
    currency: reportingCurrency,
    ...current,
    prior: {
      customersOrdered: priorFull.customersOrdered,
      repeatCustomers: priorFull.repeatCustomers,
      repeatShare: priorFull.repeatShare,
      repeatRevenueShare: priorFull.repeatRevenueShare,
    },
    change: {
      repeatShare: pctDiff(current.repeatShare, priorFull.repeatShare),
      repeatRevenueShare: pctDiff(current.repeatRevenueShare, priorFull.repeatRevenueShare),
    },
  };
}

export async function getCohortRetention(sellerId: string, months = 6): Promise<CohortRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('seller_cohort_retention', {
    p_seller_id: sellerId,
    p_months: months,
  });

  if (error) throw new Error(error.message);

  return ((data ?? []) as any[]).map((r) => ({
    cohortMonth: r.cohort_month,
    monthOffset: Number(r.month_offset),
    customers: Number(r.customers),
    retained: Number(r.retained),
    retentionRate: Number(r.retention_rate),
  }));
}
