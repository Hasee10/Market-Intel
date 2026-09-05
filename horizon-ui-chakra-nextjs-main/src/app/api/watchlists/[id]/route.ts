import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { deleteWatchlist } from '@/lib/market-intel/seller/watchlists';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    await deleteWatchlist(id);
    return NextResponse.json({ succeeded: true, data: null, errors: [], message: 'Watchlist deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        message: 'Failed to delete watchlist',
      },
      { status: 400 },
    );
  }
}
