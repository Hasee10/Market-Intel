import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { deleteWatchlist } from '@/lib/market-intel/seller/watchlists';
import { apiError } from '@/lib/api-error';

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
    await deleteWatchlist(id, seller.id);
    return NextResponse.json({ succeeded: true, data: null, errors: [], message: 'Watchlist deleted successfully' });
  } catch (error) {
    return apiError(error, 'Failed to delete watchlist', 400, 'api/watchlists/[id]');
  }
}
