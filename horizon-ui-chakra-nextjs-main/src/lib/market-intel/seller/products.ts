'server-only';

import { createClient } from '@/lib/supabase/server';
import { IProduct } from '@/types/products';

// Extracted from /api/products' GET handler so the Products page's Server
// Component can call it directly, the same move made for Overview - see
// that page's lib/market-intel/seller/overview.ts for the full rationale
// (one auth round trip instead of one per client fetch) and, importantly,
// for the mistake made and fixed there: this throws on a query error from
// the start, it does not swallow into []. POST (product creation) is left
// in the route file untouched - it's a real mutation from a client form,
// there is nothing to extract for a Server Component to call.

// Exported: POST (product creation) still needs this and PRODUCT_COLUMNS
// below to shape its own response the same way - reused rather than
// duplicated, since the two must never quietly drift apart.
export function mapProduct(row: any): IProduct {
  const category = Array.isArray(row.seller_categories) ? row.seller_categories[0] : row.seller_categories;

  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    categoryId: row.category_id,
    categoryName: category?.name ?? null,
    costPrice: row.cost_price,
    sellPrice: row.sell_price,
    currency: row.currency,
    stockQty: row.stock_qty,
    isActive: row.is_active,
    imageUrl: row.image_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const PRODUCT_COLUMNS =
  'id, sku, title, category_id, cost_price, sell_price, currency, stock_qty, is_active, image_url, created_at, updated_at, seller_categories(name)';

// Fills in a real product photo for rows the seller hasn't given one, by
// matching the title against the scraped catalogue (market_products already
// stores an image for tens of thousands of listings across 56 marketplaces).
//
// Mutates in place and never throws: an image is decoration, so a failure
// here must not take down the products list. The UI already falls back to a
// category tile when imageUrl is null.
//
// One RPC call for the whole page - see migration 050 for why, and for the
// similarity floor that stops a loose match showing the wrong product.
async function attachScrapedImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  products: IProduct[],
): Promise<void> {
  const needing = products.filter((p) => !p.imageUrl && p.title);
  if (needing.length === 0) return;

  try {
    const { data, error } = await supabase.rpc('market_images_for_titles', {
      p_titles: needing.map((p) => p.title),
    });
    if (error || !data) return;

    for (const row of data as { query_index: number; image_url: string }[]) {
      const target = needing[row.query_index];
      if (target) target.imageUrl = row.image_url;
    }
  } catch {
    // Migration 050 not applied yet, or the RPC failed - products still
    // render, just with category tiles.
  }
}

export async function getSellerProducts(sellerId: string, categoryId: string | null): Promise<IProduct[]> {
  const supabase = await createClient();
  let query = supabase
    .from('seller_products')
    .select(PRODUCT_COLUMNS)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;

  // Throws rather than swallowing - see overview.ts's header comment for
  // why that distinction matters (a real query failure must still produce
  // an error the caller can show, not silently become an empty catalogue).
  if (error) throw new Error(error.message);

  const products = (data ?? []).map(mapProduct);
  await attachScrapedImages(supabase, products);
  return products;
}
