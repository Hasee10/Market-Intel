'server-only';

import { createAdminClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications/notify';

// A price move smaller than this is noise (scrape jitter, rounding) - not
// worth alerting on. In_stock flips always alert regardless of price.
const PRICE_CHANGE_THRESHOLD_PCT = 5;

type WatchedItemRow = {
  id: string;
  watchlist_id: string;
  market_product_id: string;
  last_alerted_price: number | null;
  last_alerted_in_stock: boolean | null;
  seller_watchlists: { seller_id: string } | { seller_id: string }[];
  market_products: { title: string; price: number | null; in_stock: boolean | null } | { title: string; price: number | null; in_stock: boolean | null }[];
};

export type PriceAlertsJobResult = {
  itemsChecked: number;
  alertsSent: number;
};

// Diffs every watched product's current market_products row against the
// last price/stock state we alerted on (stored on the watchlist item
// itself), writes a seller_price_alerts audit row, and delivers via the
// shared notification pipeline. Idempotent to re-run: an item only fires
// again once its current state actually moves past the threshold from what
// was last alerted.
export async function runPriceAlertsJob(): Promise<PriceAlertsJobResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('seller_watchlist_items')
    .select(
      'id, watchlist_id, market_product_id, last_alerted_price, last_alerted_in_stock, seller_watchlists(seller_id), market_products(title, price, in_stock)',
    );

  if (error) throw new Error(`Failed to load watchlist items: ${error.message}`);

  const items = (data ?? []) as unknown as WatchedItemRow[];
  let alertsSent = 0;

  for (const item of items) {
    const watchlist = Array.isArray(item.seller_watchlists) ? item.seller_watchlists[0] : item.seller_watchlists;
    const product = Array.isArray(item.market_products) ? item.market_products[0] : item.market_products;
    if (!watchlist || !product || product.price == null) continue;

    const oldPrice = item.last_alerted_price;
    const newPrice = product.price;
    const oldInStock = item.last_alerted_in_stock;
    const newInStock = product.in_stock;

    const priceChangedEnough =
      oldPrice != null && oldPrice > 0
        ? Math.abs((newPrice - oldPrice) / oldPrice) * 100 >= PRICE_CHANGE_THRESHOLD_PCT
        : oldPrice == null;
    const stockChanged = oldInStock != null && newInStock != null && oldInStock !== newInStock;

    if (!priceChangedEnough && !stockChanged) continue;

    let reason = 'price_change';
    let title = 'Competitor price changed';
    let message = `${product.title} moved from ${oldPrice ?? 'unknown'} to ${newPrice}.`;

    if (stockChanged) {
      reason = newInStock ? 'back_in_stock' : 'out_of_stock';
      title = newInStock ? 'Competitor back in stock' : 'Competitor out of stock';
      message = `${product.title} is now ${newInStock ? 'in stock' : 'out of stock'}.`;
    }

    const { error: alertError } = await supabase.from('seller_price_alerts').insert({
      watchlist_item_id: item.id,
      seller_id: watchlist.seller_id,
      reason,
      old_price: oldPrice,
      new_price: newPrice,
      old_in_stock: oldInStock,
      new_in_stock: newInStock,
    });
    if (alertError) throw new Error(`Failed to write seller_price_alerts: ${alertError.message}`);

    await createNotification({
      sellerId: watchlist.seller_id,
      type: 'price_alert',
      title,
      message,
      metadata: { watchlistItemId: item.id, marketProductId: item.market_product_id, reason },
    });

    const { error: updateError } = await supabase
      .from('seller_watchlist_items')
      .update({ last_alerted_price: newPrice, last_alerted_in_stock: newInStock })
      .eq('id', item.id);
    if (updateError) throw new Error(`Failed to update watchlist item: ${updateError.message}`);

    alertsSent += 1;
  }

  return { itemsChecked: items.length, alertsSent };
}
