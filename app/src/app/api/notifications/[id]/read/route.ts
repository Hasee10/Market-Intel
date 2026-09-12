import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { markNotificationRead } from '@/lib/notifications/list';
import { apiError } from '@/lib/api-error';

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
    return apiError(error, 'Failed to mark notification read', 400, 'api/notifications/[id]/read');
  }
}
