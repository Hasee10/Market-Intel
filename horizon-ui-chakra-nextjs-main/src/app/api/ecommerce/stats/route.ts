import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { getEcommerceStats } from '@/lib/market-intel/seller/overview';

// Thin wrapper. The real logic lives in getEcommerceStats so the Overview
// page's Server Component can call it directly - see overview.ts's header
// comment for why that mattered for load time. This route stays so nothing
// that calls it over HTTP breaks.
export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const data = await getEcommerceStats(seller.id, seller.reportingCurrency);

  return NextResponse.json({
    succeeded: true,
    data,
    errors: [],
    message: 'E-commerce stats retrieved successfully',
  });
}
