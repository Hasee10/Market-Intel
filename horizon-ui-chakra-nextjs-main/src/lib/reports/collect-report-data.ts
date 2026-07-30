'server-only';

import { createClient } from '@/lib/supabase/server';
import { getDomainBenchmarks } from '@/lib/market-intel/benchmarks';
import { getCategoryPricing } from '@/lib/market-intel/category-pricing';
import { getPrimaryDomain, type Seller } from '@/lib/market-intel/seller';
import { getLatestChurnSnapshot } from '@/lib/market-intel/rfm';

const LOOKBACK_DAYS = 30;

export type ReportData = {
  seller: Seller;
  domainName: string | null;
  periodLabel: string;
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  activeProductCount: number;
  topProducts: { title: string; inventoryValue: number }[];
  benchmarks: { metricName: string; median: number | null; sampleSize: number }[];
  categoryPricing: { median: number; p25: number; p75: number; count: number } | null;
  churn: { retentionRate: number | null; repeatPurchaseRate: number | null; avgClv: number | null } | null;
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
      .select('total_amount')
      .eq('seller_id', seller.id)
      .gte('order_date', periodStart),
    supabase
      .from('seller_products')
      .select('title, sell_price, stock_qty, is_active')
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

  return {
    seller,
    domainName: domain?.categoryName ?? null,
    periodLabel: `Last ${LOOKBACK_DAYS} days`,
    revenue,
    orderCount,
    avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
    activeProductCount: activeProducts.length,
    topProducts,
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
  };
}
