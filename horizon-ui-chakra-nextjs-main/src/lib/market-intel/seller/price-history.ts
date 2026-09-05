'server-only';

import { createClient } from '@/lib/supabase/server';
import { getPriceTrend } from '@/lib/market-intel/market/market-insights';
import { alignSellerPriceToMarketTrend, type AlignedPricePoint } from '@/lib/market-intel/core/price-trend-alignment';

// Reads seller_product_price_history (migration 030) - populated entirely
// by a DB trigger on seller_products, not by any app-level write here. This
// module is read-only by design; there is no insert/update function to pair
// with it.
export type SellerPricePoint = { sellPrice: number | null; recordedAt: string };

export async function getSellerPriceHistory(
  sellerId: string,
  sellerProductId: string,
): Promise<SellerPricePoint[]> {
  const supabase = await createClient();

  // Scoped by both seller_id and seller_product_id - defense in depth on
  // top of RLS (same double-filter [id]/route.ts already uses for
  // seller_products lookups), not a substitute for it.
  const { data, error } = await supabase
    .from('seller_product_price_history')
    .select('sell_price, recorded_at')
    .eq('seller_id', sellerId)
    .eq('seller_product_id', sellerProductId)
    .order('recorded_at', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({ sellPrice: row.sell_price, recordedAt: row.recorded_at }));
}

export type { AlignedPricePoint };

/**
 * The seller's own price history, forward-filled onto the market's daily
 * P25-P75 band - "am I drifting out of the market, or is the market moving
 * under me", which no single snapshot can answer.
 *
 * categorySlug is the caller's to resolve (see
 * app/api/products/[id]/price-vs-market/route.ts) rather than looked up
 * here, because it comes from the product's OWN category mapping - the same
 * join the Competitors drawer's route already does - and duplicating that
 * join here would risk the two silently drifting apart on which category a
 * product belongs to.
 */
export async function getSellerPriceVsMarketTrend(
  sellerId: string,
  sellerProductId: string,
  categorySlug: string,
  reportingCurrency = 'PKR',
): Promise<AlignedPricePoint[]> {
  const [history, trend] = await Promise.all([
    getSellerPriceHistory(sellerId, sellerProductId),
    getPriceTrend(categorySlug, reportingCurrency),
  ]);

  // No market coverage for this category - an aligned series with no band
  // to draw would be a flat seller line on an empty chart, which says
  // nothing a plain "no data" doesn't say better.
  if (trend.length === 0) return [];

  return alignSellerPriceToMarketTrend(history, trend);
}
