'server-only';

import { createClient } from '@/lib/supabase/server';
import { getDomainBenchmarks } from '@/lib/market-intel/benchmarks';
import { getCategoryPricing } from '@/lib/market-intel/category-pricing';
import { getPrimaryDomain, type Seller } from '@/lib/market-intel/seller';
import { getLatestChurnSnapshot } from '@/lib/market-intel/rfm';
import { generateReportInsights, type ReportInsights } from '@/lib/ai/generate-report-insights';

const LOOKBACK_DAYS = 30;
const WEEKLY_BUCKETS = 6;
const EMPTY_INSIGHTS: ReportInsights = { summary: '', highlights: [] };

export type ReportData = {
  seller: Seller;
  domainName: string | null;
  periodLabel: string;
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  activeProductCount: number;
  topProducts: { title: string; inventoryValue: number }[];
  categoryBreakdown: { category: string; value: number }[];
  weeklyRevenue: { label: string; revenue: number }[];
  benchmarks: { metricName: string; median: number | null; sampleSize: number }[];
  categoryPricing: { median: number; p25: number; p75: number; count: number } | null;
  churn: { retentionRate: number | null; repeatPurchaseRate: number | null; avgClv: number | null } | null;
  insights: ReportInsights;
};

// Pulls together the same headline numbers a seller already sees scattered
// across Overview/Market/Customers into one report payload - reuses the
// existing benchmark/pricing/churn read functions rather than recomputing
// that logic a second time, and adds a lightweight fresh query for the
// 30-day order/product summary those pages get from the mock-style
// /api/ecommerce/* routes (not worth importing route handlers into a
// library function).
export async function collectReportData(seller: Seller): Promise<ReportData> {
  const supabase = await createClient();
  const periodStart = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const domain = await getPrimaryDomain(seller.id);

  const [ordersRes, productsRes, benchmarks, categoryPricing, churn] = await Promise.all([
    supabase
      .from('seller_orders')
      .select('total_amount, order_date')
      .eq('seller_id', seller.id)
      .gte('order_date', periodStart),
    supabase
      .from('seller_products')
      .select('title, sell_price, stock_qty, is_active, seller_categories(name)')
      .eq('seller_id', seller.id),
    domain ? getDomainBenchmarks(domain.categoryId) : Promise.resolve([]),
    domain ? getCategoryPricing(domain.categorySlug) : Promise.resolve(null),
    getLatestChurnSnapshot(seller.id),
  ]);

  const orders = ordersRes.data ?? [];
  const products = productsRes.data ?? [];

  const revenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const orderCount = orders.length;
  const activeProducts = products.filter((p) => p.is_active);

  const topProducts = [...activeProducts]
    .map((p) => ({
      title: p.title,
      inventoryValue: Number(p.sell_price ?? 0) * Number(p.stock_qty ?? 0),
    }))
    .sort((a, b) => b.inventoryValue - a.inventoryValue)
    .slice(0, 5);

  const categoryTotals = new Map<string, number>();
  for (const p of activeProducts) {
    const raw = (p as { seller_categories?: { name: string } | { name: string }[] | null }).seller_categories;
    const category = Array.isArray(raw) ? raw[0]?.name : raw?.name;
    const name = category ?? 'Uncategorized';
    const value = Number(p.sell_price ?? 0) * Number(p.stock_qty ?? 0);
    categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + value);
  }
  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Weekly buckets rather than 30 daily points - a bar chart with 30 bars
  // is unreadable on a single slide/page, 6 weekly bars reads at a glance.
  const bucketMs = (LOOKBACK_DAYS / WEEKLY_BUCKETS) * 24 * 60 * 60 * 1000;
  const periodStartMs = new Date(periodStart).getTime();
  const buckets = Array.from({ length: WEEKLY_BUCKETS }, () => 0);
  for (const order of orders) {
    const offset = new Date(order.order_date).getTime() - periodStartMs;
    const bucketIndex = Math.min(WEEKLY_BUCKETS - 1, Math.max(0, Math.floor(offset / bucketMs)));
    buckets[bucketIndex] += Number(order.total_amount);
  }
  const weeklyRevenue = buckets.map((value, i) => ({ label: `Wk ${i + 1}`, revenue: Number(value.toFixed(2)) }));

  const reportData: ReportData = {
    seller,
    domainName: domain?.categoryName ?? null,
    periodLabel: `Last ${LOOKBACK_DAYS} days`,
    revenue,
    orderCount,
    avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
    activeProductCount: activeProducts.length,
    topProducts,
    categoryBreakdown,
    weeklyRevenue,
    benchmarks: benchmarks.map((b) => ({ metricName: b.metricName, median: b.median, sampleSize: b.sampleSize })),
    categoryPricing: categoryPricing
      ? {
          median: categoryPricing.median,
          p25: categoryPricing.p25,
          p75: categoryPricing.p75,
          count: categoryPricing.count,
        }
      : null,
    churn: churn
      ? {
          retentionRate: churn.retentionRate,
          repeatPurchaseRate: churn.repeatPurchaseRate,
          avgClv: churn.avgClv,
        }
      : null,
    insights: EMPTY_INSIGHTS,
  };

  reportData.insights = await generateReportInsights(reportData);
  return reportData;
}
