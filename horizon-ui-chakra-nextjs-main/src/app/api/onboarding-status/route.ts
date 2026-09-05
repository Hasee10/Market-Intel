import { NextResponse } from 'next/server';

import { getOnboardingStatus } from '@/lib/market-intel/seller/onboarding-status';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const status = await getOnboardingStatus(seller.id);
  return NextResponse.json({ succeeded: true, data: status, errors: [], message: 'Onboarding status retrieved' });
}
