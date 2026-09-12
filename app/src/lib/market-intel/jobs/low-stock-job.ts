'server-only';

import { createAdminClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications/notify';

// Below this, a product is "low stock" - matches the threshold already used
// by the Overview page's "Low Stock Products" stat (see
// api/ecommerce/stats/route.ts) so the alert and the dashboard number agree.
// Exported so the report generator (lib/reports/collectors/revenue-and-products.ts)
// uses the same cutoff rather than picking its own number.
export const LOW_STOCK_THRESHOLD = 10;

// Re-alert at most once per day per product, so a product that's been
// sitting at 3 units for a week doesn't spam a notification every 6 hours
// alongside the price-alerts job's cadence.
const DEDUPE_WINDOW_HOURS = 24;

type LowStockProductRow = {
  id: string;
  seller_id: string;
  title: string;
  stock_qty: number | null;
};

export type LowStockJobResult = {
  productsChecked: number;
  alertsSent: number;
};

export async function runLowStockJob(): Promise<LowStockJobResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('seller_products')
    .select('id, seller_id, title, stock_qty')
    .eq('is_active', true)
    .not('stock_qty', 'is', null)
    .lt('stock_qty', LOW_STOCK_THRESHOLD);

  if (error) throw new Error(`Failed to load seller_products: ${error.message}`);

  const products = (data ?? []) as LowStockProductRow[];
  const dedupeCutoff = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  let alertsSent = 0;

  for (const product of products) {
    const { data: existing, error: existingError } = await supabase
      .from('seller_notifications')
      .select('id')
      .eq('seller_id', product.seller_id)
      .eq('type', 'low_stock')
      .gte('created_at', dedupeCutoff)
      .contains('metadata', { productId: product.id })
      .limit(1)
      .maybeSingle();

    if (existingError) throw new Error(`Failed to check existing alerts: ${existingError.message}`);
    if (existing) continue;

    await createNotification({
      sellerId: product.seller_id,
      type: 'low_stock',
      title: 'Low stock',
      message: `${product.title} has only ${product.stock_qty} units left.`,
      metadata: { productId: product.id, stockQty: product.stock_qty },
    });

    alertsSent += 1;
  }

  return { productsChecked: products.length, alertsSent };
}
