import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { getRevenueTrend } from '@/lib/market-intel/seller/overview';
import { apiError } from '@/lib/api-error';

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
    const data = await getRevenueTrend(seller.id, seller.reportingCurrency);

    return NextResponse.json({
      succeeded: true,
      data,
      errors: [],
      message: 'Revenue trend retrieved successfully',
    });
  } catch (err) {
    return apiError(err, 'Failed to fetch revenue trend', 500, 'api/ecommerce/revenue-trend');
  }
}
