import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { findCompetitorsForProduct } from '@/lib/market-intel/market/product-matching';
import { apiError } from '@/lib/api-error';

// Free for all sellers for now - intentionally not gated behind the
// product_matching paid entitlement used by the Market page's "Similar
// Products" feature. Confirmed with the product owner (2026-08-28): this
// will be gated once the wider feature set is approved. Don't silently
// reintroduce gating without checking first.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    return apiError(error, 'Failed to load product', 400, 'api/products/[id]/competitors');
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
    return NextResponse.json({ succeeded: true, data: [], errors: [], message: 'No category mapped for this product' });
  }

  const listings = await findCompetitorsForProduct(seller.id, id, categorySlug, seller.reportingCurrency ?? 'PKR');

  return NextResponse.json({ succeeded: true, data: listings, errors: [], message: 'OK' });
}
