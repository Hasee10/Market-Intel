import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { parseJsonBody } from '@/lib/api-validation';

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

// Encodes the check this route already made by hand. The gain is not the
// name check - that was already here - it's that a malformed JSON body now
// returns a 400 instead of throwing out of request.json() unhandled.
const WatchlistCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
});

export async function POST(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const parsed = await parseJsonBody(request, WatchlistCreateSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  try {
    const data = await createWatchlist(seller.id, body.name);
    return NextResponse.json({ succeeded: true, data, errors: [], message: 'Watchlist created successfully' });
  } catch (error) {
    return apiError(error, 'Failed to create watchlist', 400, 'api/watchlists');
  }
}
