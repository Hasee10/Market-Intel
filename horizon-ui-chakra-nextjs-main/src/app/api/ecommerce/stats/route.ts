import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';

// MIN_BASELINE matches lib/reports/metrics/growth.ts's buildGrowthMetric,
// added there after a live report showed "+2657.7% above median" from a
// percentage computed against a near-zero baseline (see that file's own
// comment). This route had the same unguarded division - previous===0 was
// the only case handled, so a previous value of e.g. 4.5 still produced a
// three-to-six-figure percentage on the Overview dashboard's stat cards.
// Returns null (never a huge or made-up number) below the floor; StatItem's
// `diff` is already optional and StatsGrid already hides the badge when
// diff is omitted, so null naturally renders as "no comparison shown"
// rather than a coerced 0% or a nonsense figure.
const MIN_BASELINE = 0.01;

function pctDiff(current: number, previous: number): number | null {
  if (Math.abs(previous) < MIN_BASELINE) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const supabase = await createClient();

  const now = new Date();
  const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const priorStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [ordersRes, customersRes, productsRes, fxRates] = await Promise.all([
    supabase
      .from('seller_orders')
      .select('total_amount, currency, order_date')
      .eq('seller_id', seller.id)
      .gte('order_date', priorStart.toISOString()),
    supabase
      .from('seller_customers')
      .select('id, first_order_at')
      .eq('seller_id', seller.id),
    supabase
      .from('seller_products')
      .select('id, is_active, stock_qty')
      .eq('seller_id', seller.id),
    getLatestFxRates(),
  ]);

  if (ordersRes.error || customersRes.error || productsRes.error) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [
          ordersRes.error?.message || customersRes.error?.message || productsRes.error?.message || 'Unknown error',
        ],
        message: 'Failed to fetch e-commerce stats',
      },
      { status: 500 },
    );
  }

  const reportingCurrency = seller.reportingCurrency;
  // Orders can each be in a different currency (seller_orders.currency) -
  // convert every amount into the seller's reporting currency before
  // summing, otherwise a mix of PKR/EUR/USD orders gets added together as
  // if they were the same unit (e.g. "PKR 12 + EUR 12" silently becoming 24).
  const orders = (ordersRes.data ?? []).map((o) => ({
    ...o,
    amountInReportingCurrency: convertCurrency(Number(o.total_amount), o.currency, reportingCurrency, fxRates),
  }));
  const customers = customersRes.data ?? [];
  const products = productsRes.data ?? [];

  const currentOrders = orders.filter((o) => new Date(o.order_date) >= periodStart);
  const priorOrders = orders.filter((o) => new Date(o.order_date) < periodStart);

  const currentRevenue = currentOrders.reduce((sum, o) => sum + o.amountInReportingCurrency, 0);
  const priorRevenue = priorOrders.reduce((sum, o) => sum + o.amountInReportingCurrency, 0);

  const currentAov = currentOrders.length ? currentRevenue / currentOrders.length : 0;
  const priorAov = priorOrders.length ? priorRevenue / priorOrders.length : 0;

  const currentNewCustomers = customers.filter(
    (c) => c.first_order_at && new Date(c.first_order_at) >= periodStart,
  ).length;
  const priorNewCustomers = customers.filter(
    (c) =>
      c.first_order_at &&
      new Date(c.first_order_at) < periodStart &&
      new Date(c.first_order_at) >= priorStart,
  ).length;

  const activeProducts = products.filter((p) => p.is_active).length;
  const lowStock = products.filter((p) => p.is_active && (p.stock_qty ?? 0) < 10).length;

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: reportingCurrency, maximumFractionDigits: 2 }).format(
      amount,
    );

  const data = [
    {
      title: 'Revenue (30d)',
      value: formatMoney(currentRevenue),
      diff: pctDiff(currentRevenue, priorRevenue) ?? undefined,
      period: 'vs prior 30 days',
      icon: 'currency-dollar',
      color: 'blue',
    },
    {
      title: 'Orders (30d)',
      value: currentOrders.length.toLocaleString(),
      diff: pctDiff(currentOrders.length, priorOrders.length) ?? undefined,
      period: 'vs prior 30 days',
      icon: 'shopping-cart',
      color: 'teal',
    },
    {
      title: 'Average Order Value',
      value: formatMoney(currentAov),
      diff: pctDiff(currentAov, priorAov) ?? undefined,
      period: 'vs prior 30 days',
      icon: 'receipt',
      color: 'orange',
    },
    {
      title: 'New Customers (30d)',
      value: currentNewCustomers.toLocaleString(),
      diff: pctDiff(currentNewCustomers, priorNewCustomers) ?? undefined,
      period: 'vs prior 30 days',
      icon: 'users',
      color: 'pink',
    },
    {
      title: 'Active Products',
      value: activeProducts.toLocaleString(),
      diff: 0,
      period: `of ${products.length} total`,
      icon: 'chart-line',
      color: 'violet',
    },
    {
      title: 'Low Stock Products',
      value: lowStock.toLocaleString(),
      diff: 0,
      period: 'under 10 units',
      icon: 'shopping-cart-off',
      color: 'red',
    },
  ];

  return NextResponse.json({
    succeeded: true,
    data,
    errors: [],
    message: 'E-commerce stats retrieved successfully',
  });
}
