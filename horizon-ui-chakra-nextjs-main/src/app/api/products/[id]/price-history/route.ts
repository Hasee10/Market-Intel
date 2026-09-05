import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createClient } from '@/lib/supabase/server';
import { getSellerPriceHistory } from '@/lib/market-intel/market/price-history';

// Infrastructure for a later-stage seller-vs-competitor price comparison
// feature (see memory.md, "Flagged: seller-vs-competitor price history has
// a real gap") - this route only returns the seller's own price-over-time
// series (seller_product_price_history, migration 030). No comparison
// logic against competitor prices is built here yet.
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

  // Ownership check before returning any history - same double-filter
  // pattern as [id]/competitors/route.ts.
  const { data: sellerProduct, error } = await supabase
    .from('seller_products')
    .select('id')
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

  const history = await getSellerPriceHistory(seller.id, id);

  return NextResponse.json({ succeeded: true, data: history, errors: [], message: 'OK' });
}
