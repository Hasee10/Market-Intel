import { NextRequest, NextResponse } from 'next/server';

import { apiError } from '@/lib/api-error';
import { getProductPlacement } from '@/lib/market-intel/market/placement';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';

// Where this product is listed across the market, which platform shows the
// most demand for it, and the price/stock history of each listing. See
// lib/market-intel/market/placement.ts for what the score is and is not.
//
// Same gating stance as ../competitors: free for every seller for now, on
// the product owner's explicit say-so (2026-08-28). Don't reintroduce a
// plan gate here without checking first.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const placement = await getProductPlacement(seller.id, id, seller.reportingCurrency ?? 'PKR');
    return NextResponse.json({ succeeded: true, data: placement, errors: [], message: 'OK' });
  } catch (err) {
    if (err instanceof Error && err.message === 'Product not found') {
      return NextResponse.json(
        { succeeded: false, data: null, errors: ['Product not found'], message: 'Product not found' },
        { status: 404 },
      );
    }
    return apiError(err, 'Failed to load product placement', 500, 'api/products/[id]/placement');
  }
}
