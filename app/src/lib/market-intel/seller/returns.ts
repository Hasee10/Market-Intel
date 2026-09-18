import 'server-only';

import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';
import { pctDiff } from '@/lib/market-intel/seller/overview';
import { createClient } from '@/lib/supabase/server';

// Return / refund figures from the seller's own orders.
//
// The product notes (2026-09-18) box "Return / Refund" as the item that
// matters most, and nothing on the dashboard read it. The data was already
// there: seller_orders.status accepts 'refunded' and 'cancelled' from the
// order drawers, the PUT route and bulk import, and every path has written
// it since migration 011. This is the first thing to look at it.
//
// What this is, precisely, because "return rate" means different things in
// different tools:
//
//   returnRate   = refunded orders / all orders in the window, as a percent.
//   refundValue  = sum of total_amount over refunded orders, in the seller's
//                  reporting currency.
//   cancelRate   = cancelled orders / all orders. Kept separate: a
//                  cancellation never shipped, a refund did. Lumping them
//                  hides which problem a seller has.
//
// Limits stated rather than papered over: an order is refunded whole or not
// at all (there is no refund_amount column, so no partial refunds), and
// there is no per-product view (orders have no line items - see
// Option A in the Phase 1 proposal). Both are "not modelled", not "zero".
//
// Same window mechanics as getSellerKpiTotals: one query for two periods,
// split in memory, currency-converted per order. Throws on a query error;
// the page catches and degrades the strip, the route wraps with apiError.

export type ReturnStats = {
  periodDays: number;
  currency: string;
  orders: number;
  refunded: number;
  cancelled: number;
  returnRate: number;
  cancelRate: number;
  refundValue: number;
  prior: {
    orders: number;
    refunded: number;
    cancelled: number;
    returnRate: number;
    cancelRate: number;
    refundValue: number;
  };
  /** Percent change vs the prior window; null when there is no baseline. */
  change: {
    returnRate: number | null;
    cancelRate: number | null;
    refundValue: number | null;
  };
};

type OrderRow = {
  total_amount: number | string;
  currency: string;
  order_date: string;
  status: string | null;
};

function rate(part: number, whole: number): number {
  return whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(1));
}

function summarise(orders: { amount: number; status: string | null }[]) {
  const refundedRows = orders.filter((o) => o.status === 'refunded');
  const cancelledRows = orders.filter((o) => o.status === 'cancelled');
  return {
    orders: orders.length,
    refunded: refundedRows.length,
    cancelled: cancelledRows.length,
    returnRate: rate(refundedRows.length, orders.length),
    cancelRate: rate(cancelledRows.length, orders.length),
    refundValue: Number(refundedRows.reduce((sum, o) => sum + o.amount, 0).toFixed(2)),
  };
}

export async function getReturnStats(
  sellerId: string,
  reportingCurrency: string,
  periodDays = 30,
): Promise<ReturnStats> {
  const supabase = await createClient();

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const periodStart = new Date(now.getTime() - periodDays * dayMs);
  const priorStart = new Date(now.getTime() - periodDays * 2 * dayMs);

  const [ordersRes, fxRates] = await Promise.all([
    supabase
      .from('seller_orders')
      .select('total_amount, currency, order_date, status')
      .eq('seller_id', sellerId)
      .gte('order_date', priorStart.toISOString()),
    getLatestFxRates(),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);

  const rows = ((ordersRes.data ?? []) as OrderRow[]).map((o) => ({
    amount: convertCurrency(Number(o.total_amount), o.currency, reportingCurrency, fxRates),
    status: o.status,
    date: new Date(o.order_date),
  }));

  const current = summarise(rows.filter((o) => o.date >= periodStart));
  const prior = summarise(rows.filter((o) => o.date < periodStart));

  return {
    periodDays,
    currency: reportingCurrency,
    ...current,
    prior,
    change: {
      returnRate: pctDiff(current.returnRate, prior.returnRate),
      cancelRate: pctDiff(current.cancelRate, prior.cancelRate),
      refundValue: pctDiff(current.refundValue, prior.refundValue),
    },
  };
}
