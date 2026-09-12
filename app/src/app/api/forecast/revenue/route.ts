import { NextResponse } from 'next/server';

import { hasFeature } from '@/lib/market-intel/core/entitlements';
import { getRevenueForecast } from '@/lib/market-intel/market/forecast';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  if (!hasFeature(seller.planTier, 'forecasting')) {
    return NextResponse.json({ succeeded: true, data: null, errors: [], message: 'Requires premium plan' });
  }

  const forecast = await getRevenueForecast(seller.id, seller.reportingCurrency);
  return NextResponse.json({ succeeded: true, data: forecast, errors: [], message: 'Forecast retrieved successfully' });
}
