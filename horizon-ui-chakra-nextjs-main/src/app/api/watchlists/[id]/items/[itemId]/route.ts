import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { removeWatchlistItem } from '@/lib/market-intel/seller/watchlists';

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
    await removeWatchlistItem(itemId);
    return NextResponse.json({ succeeded: true, data: null, errors: [], message: 'Item removed from watchlist' });
  } catch (error) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        message: 'Failed to remove item from watchlist',
      },
      { status: 400 },
    );
  }
}
