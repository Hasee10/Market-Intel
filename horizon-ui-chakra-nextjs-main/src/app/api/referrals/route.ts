import { NextResponse } from 'next/server';

import { getReferralStats } from '@/lib/market-intel/seller/referrals';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const stats = await getReferralStats(seller.id);
  return NextResponse.json({ succeeded: true, data: stats, errors: [], message: 'Referral stats retrieved successfully' });
}
