import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { createClient } from '@/lib/supabase/server';
import { IProductCategory } from '@/types/products';

// seller_categories is a shared, fixed taxonomy (see migration 011) used for
// benchmarking - sellers don't create or edit categories, they just pick
// from this list. This endpoint is read-only by design.
export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const supabase = await createClient();

  const [{ data: categories, error: categoriesError }, { data: products, error: productsError }] =
    await Promise.all([
      supabase.from('seller_categories').select('id, slug, name').order('name'),
      supabase
        .from('seller_products')
        .select('category_id')
        .eq('seller_id', seller.id),
    ]);

  if (categoriesError || productsError) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [categoriesError?.message ?? productsError?.message ?? 'Unknown error'],
        message: 'Failed to fetch categories',
      },
      { status: 500 },
    );
  }

  const counts = new Map<string, number>();
  (products ?? []).forEach((p) => {
    if (!p.category_id) return;
    counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  });

  const data: IProductCategory[] = (categories ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    productCount: counts.get(c.id) ?? 0,
  }));

  return NextResponse.json({
    succeeded: true,
    data,
    errors: [],
    message: 'Categories retrieved successfully',
  });
}
