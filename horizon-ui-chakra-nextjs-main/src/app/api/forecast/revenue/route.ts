import { NextResponse } from 'next/server';

import { getRevenueForecast } from '@/lib/market-intel/forecast';
import { getCurrentSeller } from '@/lib/market-intel/seller';

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const forecast = await getRevenueForecast(seller.id);
  return NextResponse.json({ succeeded: true, data: forecast, errors: [], message: 'Forecast retrieved successfully' });
}
