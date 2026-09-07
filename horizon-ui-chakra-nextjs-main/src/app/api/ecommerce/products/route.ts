import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { getTopProductsByInventoryValue } from '@/lib/market-intel/seller/overview';

// Thin wrapper - see ecommerce/stats/route.ts for why the try/catch is here
// and not left to the lib function's thrown Error.
export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  try {
    const data = await getTopProductsByInventoryValue(seller.id, seller.reportingCurrency);

    return NextResponse.json({
      succeeded: true,
      data,
      errors: [],
      message: 'Top products retrieved successfully',
    });
  } catch (err) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        message: 'Failed to fetch products',
      },
      { status: 500 },
    );
  }
}
