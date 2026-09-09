import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { parseJsonBody } from '@/lib/api-validation';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { addWatchlistItem } from '@/lib/market-intel/seller/watchlists';
import { apiError } from '@/lib/api-error';

const WatchlistItemCreateSchema = z.object({
  marketProductId: z.string().trim().min(1, 'marketProductId is required'),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const { id } = await params;
  const parsed = await parseJsonBody(request, WatchlistItemCreateSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  try {
    const data = await addWatchlistItem(id, body.marketProductId, seller.id);
    return NextResponse.json({ succeeded: true, data, errors: [], message: 'Item added to watchlist' });
  } catch (error) {
    return apiError(error, 'Failed to add item to watchlist', 400, 'api/watchlists/[id]/items');
  }
}
