'server-only';

import { createClient } from '@/lib/supabase/server';
import { convertCurrency, type FxRates } from '@/lib/market-intel/fx';
import { LOW_STOCK_THRESHOLD } from '@/lib/market-intel/jobs/low-stock-job';
import type { Seller } from '@/lib/market-intel/seller/seller';
import { buildGrowthMetric } from '../metrics/growth';
import { median } from '../metrics/statistics';
import type { InventoryRiskSection, ProductPerformanceSection, RevenueSection } from '../schema';

const WEEKLY_BUCKETS = 6;
const TOP_ROWS = 5;

export interface RevenueAndProductsResult {
  revenue: RevenueSection | null;
  productPerformance: ProductPerformanceSection | null;
  inventoryRisk: InventoryRiskSection | null;
  /**
   * Median (not mean) of active products' sell price, for the price-index/
   * positioning collector. Median, deliberately: a mean is not robust to a
   * single outlier SKU (a seller mixing a Rs 12 accessory with an Rs 1.8M
   * flagship would see their "average price" dragged toward the flagship,
   * producing a price-index ratio in the thousands of percent against a
   * category median - this is the exact failure mode a real seller's
   * downloaded report surfaced). The category-side comparison
   * (categoryPricing.median) is also a median, so this keeps the ratio
   * apples-to-apples instead of mean-vs-median. Null if no active products.
   */
  medianSellPrice: number | null;
}

// Revenue, product performance and inventory risk all come from the same
// two source tables (seller_orders, seller_products) for one seller in one
// period, so they're collected together to avoid three separate round
// trips for what is really one query pass - this mirrors how
// collect-report-data.ts already did it, just split from rendering.
export async function collectRevenueAndProducts(
  seller: Seller,
  periodStart: string,
  previousPeriodStart: string,
  fxRates: FxRates,
): Promise<RevenueAndProductsResult> {
  const supabase = await createClient();
  const reportingCurrency = seller.reportingCurrency;

  const [ordersRes, previousOrdersRes, productsRes] = await Promise.all([
    supabase
      .from('seller_orders')
      .select('total_amount, currency, order_date, status')
      .eq('seller_id', seller.id)
      .gte('order_date', periodStart),
    supabase
      .from('seller_orders')
      .select('total_amount, currency, status')
      .eq('seller_id', seller.id)
      .gte('order_date', previousPeriodStart)
      .lt('order_date', periodStart),
    supabase
      .from('seller_products')
      .select('sku, title, sell_price, currency, stock_qty, is_active, seller_categories(name)')
      .eq('seller_id', seller.id),
  ]);

  const orders = (ordersRes.data ?? []).map((o) => ({
    ...o,
    amount: convertCurrency(Number(o.total_amount), o.currency, reportingCurrency, fxRates),
  }));
  const previousOrders = (previousOrdersRes.data ?? []).map((o) => ({
    amount: convertCurrency(Number(o.total_amount), o.currency, reportingCurrency, fxRates),
    status: o.status as string | null,
  }));
  const products = (productsRes.data ?? []).map((p) => ({
    ...p,
    sell_price: convertCurrency(Number(p.sell_price ?? 0), p.currency, reportingCurrency, fxRates),
  }));

  const revenueTotal = orders.reduce((sum, o) => sum + o.amount, 0);
  const previousRevenueTotal = previousOrders.reduce((sum, o) => sum + o.amount, 0);
  const orderCount = orders.length;
  const previousOrderCount = previousOrders.length;

  // No orders in either window at all -> nothing to compare, whole section
  // omitted rather than showing a wall of zeros (per §5 inclusion rules).
  const revenue: RevenueSection | null =
    orderCount === 0 && previousOrderCount === 0
      ? null
      : {
          revenue: buildGrowthMetric(revenueTotal, previousOrderCount > 0 || previousRevenueTotal > 0 ? previousRevenueTotal : null),
          orders: buildGrowthMetric(orderCount, previousOrderCount > 0 ? previousOrderCount : null),
          avgOrderValue: buildGrowthMetric(
            orderCount > 0 ? revenueTotal / orderCount : 0,
            previousOrderCount > 0 ? previousRevenueTotal / previousOrderCount : null,
          ),
          weeklySeries: orderCount >= 2 ? buildWeeklySeries(orders, periodStart) : null,
          returns: buildReturns(orders, previousOrders),
        };

  const activeProducts = products.filter((p) => p.is_active);

  const topByValue = [...activeProducts]
    .map((p) => ({
      title: p.title,
      sku: p.sku ?? null,
      inventoryValue: Number(p.sell_price ?? 0) * Number(p.stock_qty ?? 0),
      stockQty: Number(p.stock_qty ?? 0),
    }))
    .sort((a, b) => b.inventoryValue - a.inventoryValue);

  const totalInventoryValue = topByValue.reduce((sum, p) => sum + p.inventoryValue, 0);

  const productPerformance: ProductPerformanceSection | null =
    activeProducts.length === 0
      ? null
      : {
          activeProductCount: activeProducts.length,
          // 'inventory_value', not 'revenue' - there is no order-line-item
          // table linking a sale to a specific product (checked directly,
          // see docs/reports-v2-architecture.md §2 item 0), so this can
          // never honestly claim to be revenue attribution.
          contributionBasis: 'inventory_value',
          topProducts: topByValue.slice(0, TOP_ROWS).map((p) => ({
            title: p.title,
            sku: p.sku,
            contributionShare: totalInventoryValue > 0 ? p.inventoryValue / totalInventoryValue : null,
          })),
          categoryBreakdown: buildCategoryBreakdown(activeProducts),
        };

  const medianSellPrice = median(activeProducts.map((p) => Number(p.sell_price ?? 0)));

  const lowStockSkus = activeProducts.filter((p) => Number(p.stock_qty ?? 0) < LOW_STOCK_THRESHOLD);
  const inventoryRisk: InventoryRiskSection | null =
    lowStockSkus.length === 0
      ? null // a genuinely healthy inventory state is not its own section - see §5
      : {
          lowStockSkuCount: lowStockSkus.length,
          stockoutRiskSkus: lowStockSkus
            .sort((a, b) => Number(a.stock_qty ?? 0) - Number(b.stock_qty ?? 0))
            .slice(0, TOP_ROWS)
            .map((p) => ({
              title: p.title,
              sku: p.sku ?? null,
              // No sell-through-rate/velocity data source exists yet (no
              // order-line-items - same gap as contributionBasis above), so
              // this stays null rather than fabricating a days-of-cover
              // estimate from a number that isn't tracked.
              daysOfCoverEstimate: null as number | null,
            })),
          supplyVoidOpportunities: null, // populated by the market-signals rule engine, not here
        };

  return { revenue, productPerformance, inventoryRisk, medianSellPrice };
}

// Return / refund block for the revenue section. Same definitions as
// getReturnStats (seller/returns.ts) so the report and the Orders page never
// disagree: a refund is status 'refunded', a cancellation is 'cancelled',
// rates are over ALL orders in the window, refund value is whole-order
// totals (no partial refunds are modelled). Reported whenever the period has
// orders - a 0% return rate on real orders is a fact worth stating; with no
// orders it is null, not zero.
export function buildReturns(
  orders: { amount: number; status: string | null }[],
  previousOrders: { amount: number; status: string | null }[],
): RevenueSection['returns'] {
  if (orders.length === 0) return null;
  const summarise = (rows: { amount: number; status: string | null }[]) => {
    const refunded = rows.filter((o) => o.status === 'refunded');
    const cancelled = rows.filter((o) => o.status === 'cancelled');
    const rate = (n: number) => (rows.length === 0 ? 0 : (n / rows.length) * 100);
    return {
      refunded: refunded.length,
      cancelled: cancelled.length,
      returnRate: rate(refunded.length),
      cancelRate: rate(cancelled.length),
      refundValue: refunded.reduce((sum, o) => sum + o.amount, 0),
    };
  };
  const current = summarise(orders);
  const prior = previousOrders.length > 0 ? summarise(previousOrders) : null;
  return {
    returnRate: buildGrowthMetric(current.returnRate, prior ? prior.returnRate : null),
    cancelRate: buildGrowthMetric(current.cancelRate, prior ? prior.cancelRate : null),
    refundValue: buildGrowthMetric(current.refundValue, prior ? prior.refundValue : null),
    refundedOrders: current.refunded,
    cancelledOrders: current.cancelled,
  };
}

function buildWeeklySeries(
  orders: { amount: number; order_date: string }[],
  periodStart: string,
): { label: string; value: number }[] {
  const lookbackMs = Date.now() - new Date(periodStart).getTime();
  const bucketMs = lookbackMs / WEEKLY_BUCKETS;
  const periodStartMs = new Date(periodStart).getTime();
  const buckets = Array.from({ length: WEEKLY_BUCKETS }, () => 0);

  for (const order of orders) {
    const offset = new Date(order.order_date).getTime() - periodStartMs;
    const bucketIndex = Math.min(WEEKLY_BUCKETS - 1, Math.max(0, Math.floor(offset / bucketMs)));
    buckets[bucketIndex] += order.amount;
  }

  return buckets.map((value, i) => ({ label: `Wk ${i + 1}`, value: Number(value.toFixed(2)) }));
}

function buildCategoryBreakdown(
  activeProducts: { sell_price: number; stock_qty: number | null; seller_categories: unknown }[],
): { category: string; value: number; share: number }[] {
  const totals = new Map<string, number>();
  for (const p of activeProducts) {
    const raw = p.seller_categories as { name: string } | { name: string }[] | null;
    const category = Array.isArray(raw) ? raw[0]?.name : raw?.name;
    const name = category ?? 'Uncategorized';
    const value = Number(p.sell_price ?? 0) * Number(p.stock_qty ?? 0);
    totals.set(name, (totals.get(name) ?? 0) + value);
  }
  const grandTotal = Array.from(totals.values()).reduce((sum, v) => sum + v, 0);
  return Array.from(totals.entries())
    .map(([category, value]) => ({ category, value, share: grandTotal > 0 ? value / grandTotal : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}
