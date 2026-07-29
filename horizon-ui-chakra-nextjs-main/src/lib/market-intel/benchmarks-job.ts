'server-only';

import { createAdminClient } from '@/lib/supabase/server';

// Minimum sellers contributing to a metric before we write a benchmark row.
// This is the actual anonymity guarantee referred to throughout
// 011_create_seller_platform_tables.sql's comments - below this threshold a
// competitor could plausibly reverse-engineer whose numbers they're seeing.
const MIN_SAMPLE_SIZE = 3;

const LOOKBACK_DAYS = 30;

type SellerRow = { id: string };
type DomainRow = { seller_id: string; category_id: string };
type OrderRow = { seller_id: string; total_amount: number };
type ProductRow = { seller_id: string; is_active: boolean };
type CustomerRow = { seller_id: string; orders_count: number };

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function computeMetric(categoryId: string, metricName: string, values: number[]) {
  if (values.length < MIN_SAMPLE_SIZE) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    category_id: categoryId,
    metric_name: metricName,
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    sample_size: sorted.length,
  };
}

export type BenchmarksJobResult = {
  categoriesProcessed: number;
  metricsWritten: number;
  skippedForSampleSize: number;
};

// Computes domain_benchmarks per category from every seller's own private
// data (seller_orders/seller_products/seller_customers), grouped by
// seller_domains. Runs as the service role - this is the only writer
// domain_benchmarks RLS allows (012_enable_seller_rls_policies.sql). Safe to
// re-run on a schedule: upserts on (category_id, metric_name).
export async function computeDomainBenchmarks(): Promise<BenchmarksJobResult> {
  const supabase = createAdminClient();
  const periodStart = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [domainsRes, ordersRes, productsRes, customersRes] = await Promise.all([
    supabase.from('seller_domains').select('seller_id, category_id') as unknown as Promise<{
      data: DomainRow[] | null;
      error: any;
    }>,
    supabase
      .from('seller_orders')
      .select('seller_id, total_amount')
      .gte('order_date', periodStart) as unknown as Promise<{ data: OrderRow[] | null; error: any }>,
    supabase.from('seller_products').select('seller_id, is_active') as unknown as Promise<{
      data: ProductRow[] | null;
      error: any;
    }>,
    supabase.from('seller_customers').select('seller_id, orders_count') as unknown as Promise<{
      data: CustomerRow[] | null;
      error: any;
    }>,
  ]);

  if (domainsRes.error) throw new Error(`Failed to load seller_domains: ${domainsRes.error.message}`);
  if (ordersRes.error) throw new Error(`Failed to load seller_orders: ${ordersRes.error.message}`);
  if (productsRes.error) throw new Error(`Failed to load seller_products: ${productsRes.error.message}`);
  if (customersRes.error) throw new Error(`Failed to load seller_customers: ${customersRes.error.message}`);

  const domains = domainsRes.data ?? [];
  const orders = ordersRes.data ?? [];
  const products = productsRes.data ?? [];
  const customers = customersRes.data ?? [];

  // seller_id -> set of category_ids they belong to (a seller can have
  // multiple domains - see seller_domains' comment on multi-domain support).
  const sellerCategories = new Map<string, Set<string>>();
  const categoryIds = new Set<string>();
  for (const row of domains) {
    categoryIds.add(row.category_id);
    if (!sellerCategories.has(row.seller_id)) sellerCategories.set(row.seller_id, new Set());
    sellerCategories.get(row.seller_id)!.add(row.category_id);
  }

  // Pre-aggregate per-seller raw metrics once, then fan out into every
  // category that seller belongs to.
  const revenueBySeller = new Map<string, number>();
  const orderCountBySeller = new Map<string, number>();
  for (const o of orders) {
    revenueBySeller.set(o.seller_id, (revenueBySeller.get(o.seller_id) ?? 0) + Number(o.total_amount));
    orderCountBySeller.set(o.seller_id, (orderCountBySeller.get(o.seller_id) ?? 0) + 1);
  }

  const activeProductCountBySeller = new Map<string, number>();
  for (const p of products) {
    if (!p.is_active) continue;
    activeProductCountBySeller.set(p.seller_id, (activeProductCountBySeller.get(p.seller_id) ?? 0) + 1);
  }

  const repeatCustomersBySeller = new Map<string, number>();
  const totalCustomersBySeller = new Map<string, number>();
  for (const c of customers) {
    totalCustomersBySeller.set(c.seller_id, (totalCustomersBySeller.get(c.seller_id) ?? 0) + 1);
    if (c.orders_count > 1) {
      repeatCustomersBySeller.set(c.seller_id, (repeatCustomersBySeller.get(c.seller_id) ?? 0) + 1);
    }
  }

  const rowsByCategory = new Map<
    string,
    { avgOrderValue: number[]; monthlyRevenue: number[]; activeProducts: number[]; repeatRate: number[] }
  >();

  for (const categoryId of categoryIds) {
    rowsByCategory.set(categoryId, {
      avgOrderValue: [],
      monthlyRevenue: [],
      activeProducts: [],
      repeatRate: [],
    });
  }

  for (const [sellerId, categories] of sellerCategories) {
    const revenue = revenueBySeller.get(sellerId) ?? 0;
    const orderCount = orderCountBySeller.get(sellerId) ?? 0;
    const activeProducts = activeProductCountBySeller.get(sellerId) ?? 0;
    const totalCustomers = totalCustomersBySeller.get(sellerId) ?? 0;
    const repeatCustomers = repeatCustomersBySeller.get(sellerId) ?? 0;

    for (const categoryId of categories) {
      const bucket = rowsByCategory.get(categoryId)!;
      if (orderCount > 0) bucket.avgOrderValue.push(revenue / orderCount);
      bucket.monthlyRevenue.push(revenue);
      bucket.activeProducts.push(activeProducts);
      if (totalCustomers > 0) bucket.repeatRate.push((repeatCustomers / totalCustomers) * 100);
    }
  }

  const upserts: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const [categoryId, bucket] of rowsByCategory) {
    const metrics: Array<[string, number[]]> = [
      ['avg_order_value', bucket.avgOrderValue],
      ['monthly_revenue', bucket.monthlyRevenue],
      ['active_product_count', bucket.activeProducts],
      ['repeat_purchase_rate', bucket.repeatRate],
    ];

    for (const [metricName, values] of metrics) {
      const row = computeMetric(categoryId, metricName, values);
      if (!row) {
        skipped += 1;
        continue;
      }
      upserts.push(row);
    }
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from('domain_benchmarks')
      .upsert(upserts, { onConflict: 'category_id,metric_name' });
    if (error) throw new Error(`Failed to write domain_benchmarks: ${error.message}`);
  }

  return {
    categoriesProcessed: categoryIds.size,
    metricsWritten: upserts.length,
    skippedForSampleSize: skipped,
  };
}
