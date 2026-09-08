import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { addWatchlistItem } from '@/lib/market-intel/seller/watchlists';
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
  const body = await request.json();
  if (!body?.marketProductId) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['marketProductId is required'], message: 'marketProductId is required' },
      { status: 400 },
    );
  }

  try {
    const data = await addWatchlistItem(id, body.marketProductId, seller.id);
    return NextResponse.json({ succeeded: true, data, errors: [], message: 'Item added to watchlist' });
  } catch (error) {
    return apiError(error, 'Failed to add item to watchlist', 400, 'api/watchlists/[id]/items');
  }
}
