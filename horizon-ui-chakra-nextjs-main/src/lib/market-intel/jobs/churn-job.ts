'server-only';

import { createAdminClient } from '@/lib/supabase/server';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';

const WINDOW_DAYS = 30;

type CustomerRow = {
  seller_id: string;
  orders_count: number;
  total_spent: number;
  currency: string;
  first_order_at: string | null;
  last_order_at: string | null;
};

export type ChurnJobResult = {
  sellersProcessed: number;
};

// Computes one seller_churn_snapshots row per seller for today, from their
// own seller_customers - this table already existed with nothing writing to
// it (same situation domain_benchmarks was in before Phase 1). Standard
// cohort-retention definitions, not a novel metric:
//   - "prior cohort" = customers who already existed before the current
//     30-day window AND had ordered at some point up through the prior
//     window (i.e. weren't already long gone by then)
//   - "retained" = that same cohort, restricted to those who ALSO ordered
//     again during the current window
//   - retention_rate = retained / prior cohort size (mathematically bounded
//     0-100%, since "retained" is a strict subset of "prior cohort")
//   - churn_rate = 100 - retention_rate
//   - repeat_purchase_rate = customers with orders_count > 1 / customers with any order
//
// An earlier version computed the numerator and denominator from two
// non-overlapping filters (customers whose *last* order fell in the prior
// window, vs. customers whose last order was recent AND first order was
// old) - those aren't a subset/superset pair, so the ratio could exceed
// 100% (observed: 175% retention for a real seller). This version fixes
// that by deriving "retained" as a filter *of* "prior cohort", not a
// separately-computed set.
export async function computeChurnSnapshots(): Promise<ChurnJobResult> {
  const supabase = createAdminClient();
  const now = Date.now();
  const currentStart = new Date(now - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const priorStart = new Date(now - 2 * WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const today = new Date().toISOString().slice(0, 10);

  const [{ data, error }, { data: sellers, error: sellersError }, fxRates] = await Promise.all([
    supabase
      .from('seller_customers')
      .select('seller_id, orders_count, total_spent, currency, first_order_at, last_order_at'),
    supabase.from('sellers').select('id, reporting_currency'),
    getLatestFxRates(),
  ]);

  if (error) throw new Error(`Failed to load seller_customers: ${error.message}`);
  if (sellersError) throw new Error(`Failed to load sellers: ${sellersError.message}`);

  const reportingCurrencyBySeller = new Map((sellers ?? []).map((s) => [s.id, s.reporting_currency]));

  const bySeller = new Map<string, CustomerRow[]>();
  for (const row of (data ?? []) as CustomerRow[]) {
    if (!bySeller.has(row.seller_id)) bySeller.set(row.seller_id, []);
    bySeller.get(row.seller_id)!.push(row);
  }

  const rows: Record<string, unknown>[] = [];

  for (const [sellerId, customers] of bySeller) {
    const reportingCurrency = reportingCurrencyBySeller.get(sellerId) ?? 'PKR';
    const withOrders = customers.filter((c) => c.orders_count > 0);
    const activeCurrent = withOrders.filter(
      (c) => c.last_order_at && new Date(c.last_order_at) >= currentStart,
    );

    // Existed before this window started, and hadn't already gone fully
    // quiet before the prior window even began.
    const priorCohort = withOrders.filter(
      (c) =>
        c.first_order_at &&
        new Date(c.first_order_at) < currentStart &&
        c.last_order_at &&
        new Date(c.last_order_at) >= priorStart,
    );
    // Retained = that same cohort, now also active in the current window.
    const retained = priorCohort.filter(
      (c) => c.last_order_at && new Date(c.last_order_at) >= currentStart,
    );

    const newCustomers = withOrders.filter(
      (c) => c.first_order_at && new Date(c.first_order_at) >= currentStart,
    ).length;
    const returningCustomers = activeCurrent.length - newCustomers;

    const retentionRate = priorCohort.length > 0 ? (retained.length / priorCohort.length) * 100 : null;
    const repeatPurchaseRate =
      withOrders.length > 0
        ? (withOrders.filter((c) => c.orders_count > 1).length / withOrders.length) * 100
        : null;
    // Customers can each be in a different currency (seller_customers.currency)
    // - convert to the seller's reporting currency before averaging, same
    // reasoning as the order/revenue conversions elsewhere in lib/market-intel.
    const avgClv =
      withOrders.length > 0
        ? withOrders.reduce(
            (sum, c) => sum + convertCurrency(Number(c.total_spent), c.currency, reportingCurrency, fxRates),
            0,
          ) / withOrders.length
        : null;

    rows.push({
      seller_id: sellerId,
      snapshot_date: today,
      churn_rate: retentionRate != null ? Number((100 - retentionRate).toFixed(2)) : null,
      retention_rate: retentionRate != null ? Number(retentionRate.toFixed(2)) : null,
      repeat_purchase_rate: repeatPurchaseRate != null ? Number(repeatPurchaseRate.toFixed(2)) : null,
      avg_clv: avgClv != null ? Number(avgClv.toFixed(2)) : null,
      new_customers: newCustomers,
      returning_customers: Math.max(returningCustomers, 0),
    });
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('seller_churn_snapshots')
      .upsert(rows, { onConflict: 'seller_id,snapshot_date' });
    if (upsertError) throw new Error(`Failed to write seller_churn_snapshots: ${upsertError.message}`);
  }

  return { sellersProcessed: rows.length };
}
