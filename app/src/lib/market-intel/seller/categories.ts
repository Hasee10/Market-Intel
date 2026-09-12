'server-only';

import { createClient } from '@/lib/supabase/server';
import { IProductCategory } from '@/types/products';

// Extracted from /api/product-categories' GET handler - same move as
// products.ts and overview.ts, see either's header comment for why. Throws
// on a query error rather than swallowing it, matching that established
// (and, for overview.ts, corrected-after-a-mistake) contract.
export async function getSellerCategories(sellerId: string): Promise<IProductCategory[]> {
  const supabase = await createClient();

  const [{ data: categories, error: categoriesError }, { data: products, error: productsError }] =
    await Promise.all([
      supabase.from('seller_categories').select('id, slug, name').order('name'),
      supabase.from('seller_products').select('category_id').eq('seller_id', sellerId),
    ]);

  if (categoriesError || productsError) {
    throw new Error(categoriesError?.message ?? productsError?.message ?? 'Unknown error');
  }

  const counts = new Map<string, number>();
  (products ?? []).forEach((p) => {
    if (!p.category_id) return;
    counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  });

  return (categories ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    productCount: counts.get(c.id) ?? 0,
  }));
}
