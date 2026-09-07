'server-only';

import { createClient } from '@/lib/supabase/server';
import { convertCurrency, getLatestFxRates, type FxRates } from '@/lib/market-intel/fx';

// Extracted from the five /api/ecommerce/* route handlers so the Overview
// page can call them directly, in one Promise.all, instead of issuing five
// separate HTTP requests to itself.
//
// That was the actual performance bug, not chart rendering: Overview was a
// 'use client' page firing five/seven independent fetch() calls after
// hydration, and getCurrentSeller() - cache()'d per request, but each of
// those was its OWN request - meant every single one repeated a real
// network round trip to Supabase's auth service (see seller.ts's comment on
// getCurrentSeller: "not a local JWT decode"). Seven routes meant seven
// separate auth round trips before the page was fully painted, on top of
// the client having to download and hydrate before any of it could start.
//
// The routes themselves are kept and now call these same functions, so
// nothing that hits them directly (there is no other caller today, but
// keeping the contract cheap to keep is cheaper than an audit to remove it)
// changes behaviour.
//
// Logic is copied verbatim from each route, including two inconsistencies
// worth flagging rather than silently fixing here: getOrderStatusBreakdown
// and getCategoryInventoryValue do NOT run amounts through convertCurrency
// the way getEcommerceStats/getTopProducts/getRevenueTrend do, so a seller
// with mixed-currency orders or products gets values from different
// currencies summed together in those two views. Pre-existing, unrelated to
// the performance fix, and left exactly as it behaved before this change.

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  processing: 'blue',
  shipped: 'violet',
  delivered: 'teal',
  completed: 'teal',
  cancelled: 'red',
  refunded: 'red',
};

function colorForStatus(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? 'gray';
}

const CATEGORY_PALETTE = ['blue', 'teal', 'violet', 'pink', 'orange', 'yellow', 'red', 'grape', 'cyan', 'lime'];

const MIN_BASELINE = 0.01;

function pctDiff(current: number, previous: number): number | null {
  if (Math.abs(previous) < MIN_BASELINE) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

// Shape-compatible with components/ui/StatsGrid's StatItem, defined here
// rather than imported from it - lib/ has no other reason to depend on
// components/, and TypeScript's structural typing makes this assignable
// wherever StatItem is expected without the import.
export type EcommerceStat = {
  title: string;
  value: string;
  diff?: number;
  period?: string;
  icon: string;
  color: string;
};

export async function getEcommerceStats(sellerId: string, reportingCurrency: string): Promise<EcommerceStat[]> {
  const supabase = await createClient();

  const now = new Date();
  const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const priorStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [ordersRes, customersRes, productsRes, fxRates] = await Promise.all([
    supabase
      .from('seller_orders')
      .select('total_amount, currency, order_date')
      .eq('seller_id', sellerId)
      .gte('order_date', priorStart.toISOString()),
    supabase.from('seller_customers').select('id, first_order_at').eq('seller_id', sellerId),
    supabase.from('seller_products').select('id, is_active, stock_qty').eq('seller_id', sellerId),
    getLatestFxRates(),
  ]);

  if (ordersRes.error || customersRes.error || productsRes.error) return [];

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

  return [
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
}

export type TopProductRow = {
  id: string;
  title: string;
  sku: string | null;
  imageUrl: string | null;
  category: string;
  sellPrice: number;
  costPrice: number | null;
  stockQty: number;
  inventoryValue: number;
  currency: string;
};

function mapProduct(row: any, reportingCurrency: string, fxRates: FxRates): TopProductRow {
  const category = Array.isArray(row.seller_categories) ? row.seller_categories[0] : row.seller_categories;
  const sellPrice = convertCurrency(Number(row.sell_price ?? 0), row.currency, reportingCurrency, fxRates);
  const stockQty = row.stock_qty ?? 0;

  return {
    id: row.id,
    title: row.title,
    sku: row.sku,
    imageUrl: row.image_url ?? null,
    category: category?.name ?? 'Uncategorized',
    sellPrice,
    costPrice:
      row.cost_price !== null ? convertCurrency(Number(row.cost_price), row.currency, reportingCurrency, fxRates) : null,
    stockQty,
    inventoryValue: sellPrice * stockQty,
    currency: reportingCurrency,
  };
}

export async function getTopProductsByInventoryValue(
  sellerId: string,
  reportingCurrency: string,
): Promise<TopProductRow[]> {
  const supabase = await createClient();
  const [{ data, error }, fxRates] = await Promise.all([
    supabase
      .from('seller_products')
      .select(
        'id, sku, title, cost_price, sell_price, currency, stock_qty, is_active, image_url, seller_categories(name)',
      )
      .eq('seller_id', sellerId)
      .eq('is_active', true),
    getLatestFxRates(),
  ]);

  if (error || !data) return [];

  return data
    .map((row) => mapProduct(row, reportingCurrency, fxRates))
    .sort((a, b) => b.inventoryValue - a.inventoryValue);
}

export type OrderStatusRow = { status: string; count: number; value: number; percentage: number; color: string };

export async function getOrderStatusBreakdown(sellerId: string): Promise<OrderStatusRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('seller_orders').select('status, total_amount').eq('seller_id', sellerId);

  if (error || !data) return [];

  const totalCount = data.length;
  const grouped = new Map<string, { count: number; value: number }>();
  for (const order of data) {
    const status = order.status || 'Unknown';
    const entry = grouped.get(status) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += Number(order.total_amount);
    grouped.set(status, entry);
  }

  return Array.from(grouped.entries()).map(([status, { count, value }]) => ({
    status,
    count,
    value,
    percentage: totalCount ? Number(((count / totalCount) * 100).toFixed(1)) : 0,
    color: colorForStatus(status),
  }));
}

export type CategoryRow = { category: string; value: number; products: number; percentage: number; color: string };

export async function getCategoryInventoryValue(sellerId: string): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('seller_products')
    .select('sell_price, stock_qty, is_active, seller_categories(name)')
    .eq('seller_id', sellerId)
    .eq('is_active', true);

  if (error || !data) return [];

  const grouped = new Map<string, { value: number; products: number }>();
  for (const row of data) {
    const category = Array.isArray(row.seller_categories) ? row.seller_categories[0] : row.seller_categories;
    const name = (category as { name?: string } | null)?.name ?? 'Uncategorized';
    const value = Number(row.sell_price ?? 0) * (row.stock_qty ?? 0);
    const entry = grouped.get(name) ?? { value: 0, products: 0 };
    entry.value += value;
    entry.products += 1;
    grouped.set(name, entry);
  }

  const totalValue = Array.from(grouped.values()).reduce((sum, g) => sum + g.value, 0);

  return Array.from(grouped.entries())
    .map(([category, { value, products }], index) => ({
      category,
      value,
      products,
      percentage: totalValue ? Number(((value / totalValue) * 100).toFixed(1)) : 0,
      color: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length],
    }))
    .sort((a, b) => b.value - a.value);
}

export type RevenuePoint = { date: string; revenue: number };

const REVENUE_TREND_DAYS = 30;

export async function getRevenueTrend(sellerId: string, reportingCurrency: string): Promise<RevenuePoint[]> {
  const supabase = await createClient();

  const start = new Date();
  start.setDate(start.getDate() - (REVENUE_TREND_DAYS - 1));
  start.setHours(0, 0, 0, 0);

  const [{ data, error }, fxRates] = await Promise.all([
    supabase
      .from('seller_orders')
      .select('order_date, total_amount, currency')
      .eq('seller_id', sellerId)
      .gte('order_date', start.toISOString()),
    getLatestFxRates(),
  ]);

  if (error) return [];

  const byDay = new Map<string, number>();
  for (let i = 0; i < REVENUE_TREND_DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }

  for (const order of data ?? []) {
    const key = new Date(order.order_date).toISOString().slice(0, 10);
    if (byDay.has(key)) {
      const amount = convertCurrency(Number(order.total_amount), order.currency, reportingCurrency, fxRates);
      byDay.set(key, (byDay.get(key) ?? 0) + amount);
    }
  }

  return Array.from(byDay.entries()).map(([date, revenue]) => ({ date, revenue: Number(revenue.toFixed(2)) }));
}
