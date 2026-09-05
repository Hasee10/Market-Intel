import { NextRequest, NextResponse } from 'next/server';

import { hasFeature } from '@/lib/market-intel/core/entitlements';
import { getPreLaunchInsight } from '@/lib/market-intel/market/pre-launch';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';

// The desktop counterpart to /api/mobile/price-check - same
// getPreLaunchInsight underneath, cookie-authenticated instead of bearer,
// and categorySlug is required rather than falling back to the seller's
// primary domain. The mobile route's fallback exists because a phone asks
// this question about a category the seller already sells in; the Explore
// page this feeds is specifically for browsing a category the seller does
// NOT track yet, so there is no "primary domain" that would even be the
// right default here - the category the page is already showing is the
// only sensible one.
//
// Gated the same way the Explore page itself is (competitor_intel, paid) -
// checked here as well as in the page, since a route reachable while
// UpgradeGate is showing on the client would be a paywall hole.

const MAX_TITLE_LENGTH = 200;

export async function GET(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  if (!hasFeature(seller.planTier, 'competitor_intel')) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Upgrade required'], message: 'Upgrade required' },
      { status: 403 },
    );
  }

  const params = request.nextUrl.searchParams;
  const title = (params.get('title') ?? '').trim();
  const categorySlug = params.get('categorySlug');
  const categoryName = params.get('categoryName');

  if (!title) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['A product title is required'], message: 'A product title is required' },
      { status: 400 },
    );
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json(
      {
        succeeded: false,
        data: null,
        errors: [`Titles are capped at ${MAX_TITLE_LENGTH} characters`],
        message: 'Title too long',
      },
      { status: 400 },
    );
  }

  if (!categorySlug) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['A category is required'], message: 'A category is required' },
      { status: 400 },
    );
  }

  // An unparseable price is dropped rather than rejected, same as the
  // mobile route: the price is an optional refinement, and failing the
  // whole lookup over it would withhold the market read the seller
  // actually asked for.
  const rawPrice = params.get('intendedPrice');
  const parsedPrice = rawPrice != null ? Number(rawPrice) : NaN;
  const intendedPrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : null;

  const insight = await getPreLaunchInsight(title, categorySlug, seller.reportingCurrency ?? 'PKR', {
    // No sellerId: Explore's whole premise is a category the seller does
    // not track, so the default (unfiltered) market scope is the right
    // one - the same scope getCompetitorLandscape(categorySlug) uses
    // without a sellerId elsewhere on this page.
    intendedPrice,
    categoryName,
  });

  return NextResponse.json({ succeeded: true, data: insight, errors: [], message: 'OK' });
}
