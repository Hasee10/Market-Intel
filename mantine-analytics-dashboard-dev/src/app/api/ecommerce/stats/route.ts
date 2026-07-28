import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { createClient } from '@/lib/supabase/server';

function pctDiff(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
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

  const [ordersRes, customersRes, productsRes] = await Promise.all([
    supabase
      .from('seller_orders')
      .select('total_amount, order_date')
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

  const orders = ordersRes.data ?? [];
  const customers = customersRes.data ?? [];
  const products = productsRes.data ?? [];

  const currentOrders = orders.filter((o) => new Date(o.order_date) >= periodStart);
  const priorOrders = orders.filter((o) => new Date(o.order_date) < periodStart);

  const currentRevenue = currentOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const priorRevenue = priorOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

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

  const data = [
    {
      title: 'Revenue (30d)',
      value: `$${currentRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      diff: pctDiff(currentRevenue, priorRevenue),
      period: 'vs prior 30 days',
      icon: 'currency-dollar',
      color: 'blue',
    },
    {
      title: 'Orders (30d)',
      value: currentOrders.length.toLocaleString(),
      diff: pctDiff(currentOrders.length, priorOrders.length),
      period: 'vs prior 30 days',
      icon: 'shopping-cart',
      color: 'teal',
    },
    {
      title: 'Average Order Value',
      value: `$${currentAov.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      diff: pctDiff(currentAov, priorAov),
      period: 'vs prior 30 days',
      icon: 'receipt',
      color: 'orange',
    },
    {
      title: 'New Customers (30d)',
      value: currentNewCustomers.toLocaleString(),
      diff: pctDiff(currentNewCustomers, priorNewCustomers),
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
