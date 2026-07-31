'server-only';

import { createClient } from '@/lib/supabase/server';
import { getDomainBenchmarks } from '@/lib/market-intel/benchmarks';
import { getCategoryPricing } from '@/lib/market-intel/category-pricing';
import { CATEGORY_KEYWORDS } from '@/lib/market-intel/category-keywords';
import { getPrimaryDomain, type Seller } from '@/lib/market-intel/seller';
import { getLatestChurnSnapshot, getAtRiskCustomers } from '@/lib/market-intel/rfm';
import { LOW_STOCK_THRESHOLD } from '@/lib/market-intel/low-stock-job';
import { generateReportInsights, type ReportInsights } from '@/lib/ai/generate-report-insights';

const LOOKBACK_DAYS = 30;
const WEEKLY_BUCKETS = 6;
const EMPTY_INSIGHTS: ReportInsights = { summary: '', highlights: [], recommendedActions: [] };
const TRACKED_SKU_ROWS = 5;
const PORTFOLIO_ROWS = 5;

export type CompetitorTrackingRow = {
  title: string;
  priceDeltaPct: number | null;
  stockState: 'In Stock' | 'Out of Stock';
  signal: string;
  riskLevel: 'High Risk' | 'Medium' | 'Low Risk' | 'Opportunity';
};

export type PortfolioRow = {
  title: string;
  revenueSharePct: number;
  priceIndex: number | null;
  stockRisk: 'High' | 'Medium' | 'Low';
  strategicAction: string;
};

export type ReportData = {
  seller: Seller;
  domainName: string | null;
  periodLabel: string;
  revenue: number;
  previousRevenue: number;
  orderCount: number;
  previousOrderCount: number;
  avgOrderValue: number;
  activeProductCount: number;
  lowStockCount: number;
  priceIndex: number | null;
  atRiskCount: number;
  topProducts: { title: string; inventoryValue: number }[];
  categoryBreakdown: { category: string; value: number }[];
  weeklyRevenue: { label: string; revenue: number }[];
  benchmarks: { metricName: string; median: number | null; sampleSize: number }[];
  categoryPricing: { median: number; p25: number; p75: number; count: number } | null;
  churn: { retentionRate: number | null; repeatPurchaseRate: number | null; avgClv: number | null } | null;
  competitorTracking: CompetitorTrackingRow[];
  portfolioMatrix: PortfolioRow[];
  insights: ReportInsights;
};

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

// Top scraped competitor listings in this seller's category, for the
// "Public Marketplace SKU Tracking" table - reuses the same category-slug
// keyword matching as getCategoryPricing(), unioned across market_products
// (retailer marketplaces) and market_classified_listings (OLX), since some
// seller categories only have OLX coverage. Classifieds have no in_stock
// column - status:'active' (already required by the query) stands in for it.
async function getCompetitorTracking(categorySlug: string | null, median: number | null): Promise<CompetitorTrackingRow[]> {
  if (!categorySlug) return [];
  const keywordPattern = CATEGORY_KEYWORDS[categorySlug];
  if (!keywordPattern) return [];

  const supabase = await createClient();
  const [productsRes, listingsRes] = await Promise.all([
    supabase
      .from('market_products')
      .select('title, price, category_slug, in_stock, last_seen_at')
      .not('price', 'is', null)
      .order('last_seen_at', { ascending: false })
      .limit(200),
    supabase
      .from('market_classified_listings')
      .select('title, price, category_slug, last_seen_at')
      .eq('status', 'active')
      .not('price', 'is', null)
      .order('last_seen_at', { ascending: false })
      .limit(200),
  ]);

  const productRows = (productsRes.data ?? []).map((row) => ({ ...row, in_stock: row.in_stock as boolean | null }));
  const listingRows = (listingsRes.data ?? []).map((row) => ({ ...row, in_stock: true as boolean | null }));
  const data = [...productRows, ...listingRows].sort(
    (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
  );
  if (data.length === 0) return [];

  const matched = data.filter((row) => row.category_slug && keywordPattern.test(row.category_slug)).slice(0, TRACKED_SKU_ROWS);

  return matched.map((row) => {
    const price = Number(row.price);
    const priceDeltaPct = median ? ((price - median) / median) * 100 : null;
    const stockState: CompetitorTrackingRow['stockState'] = row.in_stock === false ? 'Out of Stock' : 'In Stock';

    let signal = 'Stable Volume';
    let riskLevel: CompetitorTrackingRow['riskLevel'] = 'Low Risk';
    if (stockState === 'Out of Stock') {
      signal = 'Supply Void';
      riskLevel = 'Opportunity';
    } else if (priceDeltaPct != null && priceDeltaPct <= -5) {
      signal = 'Demand Rising';
      riskLevel = 'High Risk';
    } else if (priceDeltaPct != null && priceDeltaPct <= -1) {
      signal = 'Competitor Promo';
      riskLevel = 'Medium';
    } else if (priceDeltaPct != null && Math.abs(priceDeltaPct) < 0.5) {
      signal = 'Flat Trend';
      riskLevel = 'Low Risk';
    }

    return { title: row.title, priceDeltaPct, stockState, signal, riskLevel };
  });
}

function strategicAction(priceIndex: number | null, stockRisk: PortfolioRow['stockRisk']): string {
  if (stockRisk === 'High') return 'Accelerate reorder before stockout';
  if (priceIndex != null && priceIndex < 95) return `Raise price range toward category median`;
  if (priceIndex != null && priceIndex > 105) return 'Review pricing - trailing above median';
  if (stockRisk === 'Medium') return 'Monitor inventory turnover closely';
  return 'Maintain current pricing stability';
}

// Pulls together the same headline numbers a seller already sees scattered
// across Overview/Market/Customers into one report payload, plus the extra
// derived metrics (price index, competitor tracking, portfolio matrix) that
// the Ryvl enterprise report template (see generate-pptx.ts) expects on its
// executive-summary and portfolio slides.
export async function collectReportData(seller: Seller): Promise<ReportData> {
  const supabase = await createClient();
  const periodStart = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const previousPeriodStart = new Date(Date.now() - LOOKBACK_DAYS * 2 * 24 * 60 * 60 * 1000).toISOString();

  const domain = await getPrimaryDomain(seller.id);

  const [ordersRes, previousOrdersRes, productsRes, benchmarks, categoryPricing, churn, atRiskCustomers] = await Promise.all([
    supabase
      .from('seller_orders')
      .select('total_amount, order_date')
      .eq('seller_id', seller.id)
      .gte('order_date', periodStart),
    supabase
      .from('seller_orders')
      .select('total_amount')
      .eq('seller_id', seller.id)
      .gte('order_date', previousPeriodStart)
      .lt('order_date', periodStart),
    supabase
      .from('seller_products')
      .select('title, sell_price, stock_qty, is_active, seller_categories(name)')
      .eq('seller_id', seller.id),
    domain ? getDomainBenchmarks(domain.categoryId) : Promise.resolve([]),
    domain ? getCategoryPricing(domain.categorySlug, seller.reportingCurrency) : Promise.resolve(null),
    getLatestChurnSnapshot(seller.id),
    getAtRiskCustomers(seller.id),
  ]);

  const orders = ordersRes.data ?? [];
  const previousOrders = previousOrdersRes.data ?? [];
  const products = productsRes.data ?? [];

  const revenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const previousRevenue = previousOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const orderCount = orders.length;
  const previousOrderCount = previousOrders.length;
  const activeProducts = products.filter((p) => p.is_active);
  const lowStockCount = activeProducts.filter((p) => Number(p.stock_qty ?? 0) < LOW_STOCK_THRESHOLD).length;

  const avgSellPrice =
    activeProducts.length > 0
      ? activeProducts.reduce((sum, p) => sum + Number(p.sell_price ?? 0), 0) / activeProducts.length
      : null;
  const priceIndex = avgSellPrice != null && categoryPricing?.median ? (avgSellPrice / categoryPricing.median) * 100 : null;

  const topProducts = [...activeProducts]
    .map((p) => ({
      title: p.title,
      inventoryValue: Number(p.sell_price ?? 0) * Number(p.stock_qty ?? 0),
      sellPrice: Number(p.sell_price ?? 0),
      stockQty: Number(p.stock_qty ?? 0),
    }))
    .sort((a, b) => b.inventoryValue - a.inventoryValue)
    .slice(0, Math.max(TRACKED_SKU_ROWS, PORTFOLIO_ROWS));

  const totalInventoryValue = topProducts.reduce((sum, p) => sum + p.inventoryValue, 0);
  const portfolioMatrix: PortfolioRow[] = topProducts.slice(0, PORTFOLIO_ROWS).map((p) => {
    const stockRisk: PortfolioRow['stockRisk'] =
      p.stockQty < LOW_STOCK_THRESHOLD / 2 ? 'High' : p.stockQty < LOW_STOCK_THRESHOLD ? 'Medium' : 'Low';
    const productPriceIndex = categoryPricing?.median ? (p.sellPrice / categoryPricing.median) * 100 : null;
    return {
      title: p.title,
      revenueSharePct: totalInventoryValue > 0 ? (p.inventoryValue / totalInventoryValue) * 100 : 0,
      priceIndex: productPriceIndex,
      stockRisk,
      strategicAction: strategicAction(productPriceIndex, stockRisk),
    };
  });

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

  const competitorTracking = await getCompetitorTracking(domain?.categorySlug ?? null, categoryPricing?.median ?? null);

  const reportData: ReportData = {
    seller,
    domainName: domain?.categoryName ?? null,
    periodLabel: `Last ${LOOKBACK_DAYS} days`,
    revenue,
    previousRevenue,
    orderCount,
    previousOrderCount,
    avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
    activeProductCount: activeProducts.length,
    lowStockCount,
    priceIndex,
    atRiskCount: atRiskCustomers.length,
    topProducts: topProducts.map((p) => ({ title: p.title, inventoryValue: p.inventoryValue })).slice(0, 5),
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
    competitorTracking,
    portfolioMatrix,
    insights: EMPTY_INSIGHTS,
  };

  reportData.insights = await generateReportInsights(reportData);
  return reportData;
}

export { pctChange };
