import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { createWatchlist, listWatchlists } from '@/lib/market-intel/seller/watchlists';
import { apiError } from '@/lib/api-error';

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const data = await listWatchlists(seller.id);
  return NextResponse.json({ succeeded: true, data, errors: [], message: 'Watchlists retrieved successfully' });
}

export async function POST(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const body = await request.json();
  if (!body?.name || typeof body.name !== 'string') {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['name is required'], message: 'name is required' },
      { status: 400 },
    );
  }

  try {
    const data = await createWatchlist(seller.id, body.name);
    return NextResponse.json({ succeeded: true, data, errors: [], message: 'Watchlist created successfully' });
  } catch (error) {
    return apiError(error, 'Failed to create watchlist', 400, 'api/watchlists');
  }
}
