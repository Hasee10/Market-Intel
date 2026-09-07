import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { getRevenueTrend } from '@/lib/market-intel/seller/overview';

// Thin wrapper - see ecommerce/stats/route.ts.
export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const data = await getRevenueTrend(seller.id, seller.reportingCurrency);

  return NextResponse.json({
    succeeded: true,
    data,
    errors: [],
    message: 'Revenue trend retrieved successfully',
  });
}
