import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { getEcommerceStats } from '@/lib/market-intel/seller/overview';

// Thin wrapper. The real logic lives in getEcommerceStats so the Overview
// page's Server Component can call it directly - see overview.ts's header
// comment for why that mattered for load time. This route stays so nothing
// that calls it over HTTP breaks - including its error response, which is
// why the query failure is caught and rebuilt here rather than left to
// getEcommerceStats' thrown Error to become an unhandled 500 with Next's
// generic shape instead of this route's own.
export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  try {
    const data = await getEcommerceStats(seller.id, seller.reportingCurrency);

    return NextResponse.json({
      succeeded: true,
      data,
      errors: [],
      message: 'E-commerce stats retrieved successfully',
    });
  } catch (err) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        message: 'Failed to fetch e-commerce stats',
      },
      { status: 500 },
    );
  }
}
