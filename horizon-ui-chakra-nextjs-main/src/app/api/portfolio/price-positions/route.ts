import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { getPortfolioPricePositions } from '@/lib/market-intel/seller/portfolio-pricing';

// Unauthenticated-free-tier-equivalent: no feature gate, matching the
// "Category pricing (market-wide)" card on the Market page this reuses -
// both read the same getCategoryPricing, and gating one but not the other
// would be an inconsistent paywall over identical data.
export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const positions = await getPortfolioPricePositions(seller.id, seller.reportingCurrency ?? 'PKR');

  return NextResponse.json({ succeeded: true, data: positions, errors: [], message: 'OK' });
}
