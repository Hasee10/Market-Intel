import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { getAtRiskCustomers, getLatestChurnSnapshot } from '@/lib/market-intel/seller/rfm';

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const [snapshot, atRiskCustomers] = await Promise.all([
    getLatestChurnSnapshot(seller.id),
    getAtRiskCustomers(seller.id, seller.reportingCurrency),
  ]);

  return NextResponse.json({
    succeeded: true,
    data: { snapshot, atRiskCustomers, reportingCurrency: seller.reportingCurrency },
    errors: [],
    message: 'Retention data retrieved successfully',
  });
}
