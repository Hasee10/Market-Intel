import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { listNotifications } from '@/lib/notifications/list';

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const data = await listNotifications(seller.id);
  return NextResponse.json({ succeeded: true, data, errors: [], message: 'Notifications retrieved successfully' });
}
