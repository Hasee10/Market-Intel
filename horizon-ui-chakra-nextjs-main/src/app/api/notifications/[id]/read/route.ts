import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { markNotificationRead } from '@/lib/notifications/list';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    await markNotificationRead(id);
    return NextResponse.json({ succeeded: true, data: null, errors: [], message: 'Notification marked read' });
  } catch (error) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        message: 'Failed to mark notification read',
      },
      { status: 400 },
    );
  }
}
