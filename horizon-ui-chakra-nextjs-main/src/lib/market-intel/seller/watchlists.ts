'server-only';

import { getMarketScope } from '@/lib/market-intel/market/market-definition';
import { createClient } from '@/lib/supabase/server';

export type WatchlistItem = {
  id: string;
  marketProductId: string;
  title: string;
  platformName: string | null;
  url: string;
  /**
   * Scraped listing image. market_products.image_url has existed since
   * migration 001 and most sources populate it (daraz, shophive, priceoye,
   * naheed, telemart, the shopify/woo adapters...), but it is nullable and
   * points at a third-party host, so ProductThumb falls back to a tile.
   */
  imageUrl: string | null;
  price: number | null;
  inStock: boolean | null;
  lastAlertedPrice: number | null;
  createdAt: string;
};

export type Watchlist = {
  id: string;
  name: string;
  createdAt: string;
  items: WatchlistItem[];
};

function mapItem(row: any): WatchlistItem {
  const product = Array.isArray(row.market_products) ? row.market_products[0] : row.market_products;
  const platform = product && Array.isArray(product.market_platforms)
    ? product.market_platforms[0]
    : product?.market_platforms;

  return {
    id: row.id,
    marketProductId: row.market_product_id,
    title: product?.title ?? 'Unknown product',
    platformName: platform?.name ?? null,
    url: product?.url ?? '#',
    imageUrl: product?.image_url ?? null,
    price: product?.price ?? null,
    inStock: product?.in_stock ?? null,
    lastAlertedPrice: row.last_alerted_price,
    createdAt: row.created_at,
  };
}

// RLS scopes every query here to the calling seller (seller_watchlists_owner_all
// / seller_watchlist_items_owner_all in 014) - no explicit seller_id filter
// needed beyond what createClient()'s cookie-bound client already enforces.
export async function listWatchlists(sellerId: string): Promise<Watchlist[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_watchlists')
    .select(
      'id, name, created_at, seller_watchlist_items(id, market_product_id, last_alerted_price, created_at, market_products(title, url, image_url, price, in_stock, market_platforms(name)))',
    )
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    items: (row.seller_watchlist_items ?? []).map(mapItem),
  }));
}

export async function createWatchlist(sellerId: string, name: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_watchlists')
    .insert({ seller_id: sellerId, name })
    .select('id, name, created_at')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create watchlist');

  return { id: data.id, name: data.name, createdAt: data.created_at, items: [] as WatchlistItem[] };
}

export async function deleteWatchlist(watchlistId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('seller_watchlists').delete().eq('id', watchlistId);
  if (error) throw new Error(error.message);
}

export async function addWatchlistItem(watchlistId: string, marketProductId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_watchlist_items')
    .insert({ watchlist_id: watchlistId, market_product_id: marketProductId })
    .select('id, market_product_id, last_alerted_price, created_at, market_products(title, url, image_url, price, in_stock, market_platforms(name))')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to add item');

  return mapItem(data);
}

export async function removeWatchlistItem(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('seller_watchlist_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
}

export type ProductSearchResult = {
  id: string;
  title: string;
  platformName: string | null;
  /** Same nullable scraped image as WatchlistItem - the picker shows the
   *  thumbnail the row will get once added, so the two agree. */
  imageUrl: string | null;
  price: number | null;
  inStock: boolean | null;
  url: string;
};

// Lets a seller search scraped competitor products to add to a watchlist.
// market_products has no RLS (it's public marketplace data, never private -
// see 011's header comment), so this is readable by any authenticated seller.
//
// `sellerCategorySlug` is the *seller's* category ("mobiles-and-electronics"),
// which is not what market_products.category_slug holds - that column stores
// the scraped platform slug ("smartphones", "laptops", "audio"). Comparing the
// two directly matched zero rows, so search silently returned nothing for
// every onboarded seller. Resolve through the taxonomy (migration 020) the
// same way every other market surface does, which also means search now
// respects the seller's own market definition instead of ignoring it.
export async function searchMarketProducts(
  query: string,
  sellerCategorySlug?: string,
): Promise<ProductSearchResult[]> {
  const supabase = await createClient();

  let builder = supabase
    .from('market_products')
    .select('id, title, image_url, price, in_stock, url, market_platforms(name)')
    .ilike('title', `%${query}%`)
    .eq('is_active', true)
    .limit(20);

  if (sellerCategorySlug) {
    const scope = await getMarketScope(sellerCategorySlug);
    // A seller category with no taxonomy at all (e.g. `other`) has nothing to
    // scope to. Searching the whole scraped market beats returning nothing,
    // and matches how the taxonomy-less case is handled elsewhere.
    if (scope.categorySlugs.length > 0) {
      builder = builder.in('category_slug', scope.categorySlugs);
    }
  }

  const { data, error } = await builder;
  if (error || !data) return [];

  return data.map((row: any) => {
    const platform = Array.isArray(row.market_platforms) ? row.market_platforms[0] : row.market_platforms;
    return {
      id: row.id,
      title: row.title,
      platformName: platform?.name ?? null,
      imageUrl: row.image_url ?? null,
      price: row.price,
      inStock: row.in_stock,
      url: row.url,
    };
  });
}
