import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { removeWatchlistItem } from '@/lib/market-intel/seller/watchlists';
import { apiError } from '@/lib/api-error';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { itemId } = await params;

  try {
    await removeWatchlistItem(itemId, seller.id);
    return NextResponse.json({ succeeded: true, data: null, errors: [], message: 'Item removed from watchlist' });
  } catch (error) {
    return apiError(error, 'Failed to remove item from watchlist', 400, 'api/watchlists/[id]/items/[itemId]');
  }
}
