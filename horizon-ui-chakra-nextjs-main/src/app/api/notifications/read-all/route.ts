import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { markAllNotificationsRead } from '@/lib/notifications/list';

// Counterpart to [id]/read for clearing the whole feed at once - the
// Watchlist's "Mark all read". Same response envelope as every other route
// here so the client's error handling does not need a special case.
export async function POST() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  try {
    await markAllNotificationsRead(seller.id);
    return NextResponse.json({
      succeeded: true,
      data: null,
      errors: [],
      message: 'All notifications marked read',
    });
  } catch (error) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        message: 'Failed to mark notifications read',
      },
      { status: 400 },
    );
  }
}
