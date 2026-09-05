import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { getSellerPriceVsMarketTrend } from '@/lib/market-intel/seller/price-history';

// Same category-resolution shape as [id]/competitors/route.ts, deliberately
// duplicated rather than shared: this is the one place a product's category
// slug is derived from its own seller_categories join, and the two routes
// independently arriving at the same answer is the point - not a shared
// helper that could silently diverge from what the drawer shows.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: sellerProduct, error } = await supabase
    .from('seller_products')
    .select('id, category_id, seller_categories(slug)')
    .eq('id', id)
    .eq('seller_id', seller.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: [error.message], message: 'Failed to load product' },
      { status: 400 },
    );
  }

  if (!sellerProduct) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Product not found'], message: 'Product not found' },
      { status: 404 },
    );
  }

  const category = Array.isArray(sellerProduct.seller_categories)
    ? sellerProduct.seller_categories[0]
    : sellerProduct.seller_categories;
  const categorySlug = category?.slug ?? null;

  if (!categorySlug) {
    return NextResponse.json({
      succeeded: true,
      data: [],
      errors: [],
      message: 'No category mapped for this product',
    });
  }

  const points = await getSellerPriceVsMarketTrend(seller.id, id, categorySlug, seller.reportingCurrency ?? 'PKR');

  return NextResponse.json({ succeeded: true, data: points, errors: [], message: 'OK' });
}
