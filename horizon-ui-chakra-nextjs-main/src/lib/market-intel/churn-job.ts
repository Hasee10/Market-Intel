'server-only';

import { createAdminClient } from '@/lib/supabase/server';

const WINDOW_DAYS = 30;

type CustomerRow = {
  seller_id: string;
  orders_count: number;
  total_spent: number;
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
//   - "current window" = last_order_at in the last 30 days
//   - "prior window" = last_order_at 30-60 days ago
//   - retention_rate = (customers active in both windows) / (active in prior window)
//   - churn_rate = 100 - retention_rate
//   - repeat_purchase_rate = customers with orders_count > 1 / customers with any order
export async function computeChurnSnapshots(): Promise<ChurnJobResult> {
  const supabase = createAdminClient();
  const now = Date.now();
  const currentStart = new Date(now - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const priorStart = new Date(now - 2 * WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('seller_customers')
    .select('seller_id, orders_count, total_spent, first_order_at, last_order_at');

  if (error) throw new Error(`Failed to load seller_customers: ${error.message}`);

  const bySeller = new Map<string, CustomerRow[]>();
  for (const row of (data ?? []) as CustomerRow[]) {
    if (!bySeller.has(row.seller_id)) bySeller.set(row.seller_id, []);
    bySeller.get(row.seller_id)!.push(row);
  }

  const rows: Record<string, unknown>[] = [];

  for (const [sellerId, customers] of bySeller) {
    const withOrders = customers.filter((c) => c.orders_count > 0);
    const activeCurrent = withOrders.filter(
      (c) => c.last_order_at && new Date(c.last_order_at) >= currentStart,
    );
    const activePrior = withOrders.filter(
      (c) =>
        c.last_order_at &&
        new Date(c.last_order_at) >= priorStart &&
        new Date(c.last_order_at) < currentStart,
    );
    const activeBothWindows = withOrders.filter(
      (c) =>
        c.last_order_at &&
        new Date(c.last_order_at) >= currentStart &&
        c.first_order_at &&
        new Date(c.first_order_at) < currentStart,
    );

    const newCustomers = withOrders.filter(
      (c) => c.first_order_at && new Date(c.first_order_at) >= currentStart,
    ).length;
    const returningCustomers = activeCurrent.length - newCustomers;

    const retentionRate =
      activePrior.length > 0 ? (activeBothWindows.length / activePrior.length) * 100 : null;
    const repeatPurchaseRate =
      withOrders.length > 0
        ? (withOrders.filter((c) => c.orders_count > 1).length / withOrders.length) * 100
        : null;
    const avgClv =
      withOrders.length > 0
        ? withOrders.reduce((sum, c) => sum + Number(c.total_spent), 0) / withOrders.length
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
