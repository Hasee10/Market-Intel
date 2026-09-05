import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { searchMarketProducts } from '@/lib/market-intel/seller/watchlists';

export async function GET(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  const query = request.nextUrl.searchParams.get('q');
  const categorySlug = request.nextUrl.searchParams.get('categorySlug') ?? undefined;

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ succeeded: true, data: [], errors: [], message: 'Provide at least 2 characters' });
  }

  const data = await searchMarketProducts(query.trim(), categorySlug);
  return NextResponse.json({ succeeded: true, data, errors: [], message: 'Products retrieved successfully' });
}
