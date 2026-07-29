import { NextResponse } from 'next/server';

import { detectOwnRevenueAnomalies } from '@/lib/market-intel/anomalies';
import { getCurrentSeller } from '@/lib/market-intel/seller';

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const anomalies = await detectOwnRevenueAnomalies(seller.id);
  return NextResponse.json({ succeeded: true, data: anomalies, errors: [], message: 'Anomalies retrieved successfully' });
}
