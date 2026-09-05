'server-only';

import { createClient } from '@/lib/supabase/server';

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
