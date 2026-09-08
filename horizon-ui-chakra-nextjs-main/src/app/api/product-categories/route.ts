import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { getSellerCategories } from '@/lib/market-intel/seller/categories';
import { apiError } from '@/lib/api-error';

// seller_categories is a shared, fixed taxonomy (see migration 011) used for
// benchmarking - sellers don't create or edit categories, they just pick
// from this list. This endpoint is read-only by design.
//
// Thin wrapper - see products.ts's header comment for why the real logic
// lives in getSellerCategories now.
export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  try {
    const data = await getSellerCategories(seller.id);

    return NextResponse.json({
      succeeded: true,
      data,
      errors: [],
      message: 'Categories retrieved successfully',
    });
  } catch (err) {
    return apiError(err, 'Failed to fetch categories', 500, 'api/product-categories');
  }
}
