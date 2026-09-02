import { NextRequest, NextResponse } from 'next/server';

import { objectsToCsv } from '@/lib/csv';
import { getMatchedListingsForExport } from '@/lib/market-intel/competitors';
import { hasFeature } from '@/lib/market-intel/entitlements';
import { getMarketScope, getMarketScopeForAllDomains } from '@/lib/market-intel/market-definition';
import { getCurrentSeller, getPrimaryDomain } from '@/lib/market-intel/seller';

// The matched-listings CSV, built on demand.
//
// This used to be computed in the Competitors page's own Promise.all - twice,
// once per tab - and handed to the client as props purely so two export
// buttons could exist. getMatchedListingsForExport is capped at
// MAX_MATCH_ROWS (2000), so that was up to 4000 rows of listing data
// serialised into every page view, plus two queries the page had to await
// before it could render, for a button most visits never click.
//
// Returning text/csv rather than JSON keeps the whole thing server-side:
// nothing crosses the wire until the seller actually asks for the file.
export async function GET(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Not authenticated'], message: 'Not authenticated' },
      { status: 401 },
    );
  }

  // Same entitlement that gates the page itself - without this the export
  // would be a way around the paywall the UI puts in front of the data.
  if (!hasFeature(seller.planTier ?? 'free', 'competitor_intel')) {
    return NextResponse.json(
      { succeeded: false, data: null, errors: ['Upgrade required'], message: 'Upgrade required' },
      { status: 403 },
    );
  }

  const scopeParam = request.nextUrl.searchParams.get('scope');
  const allDomains = scopeParam === 'all';

  let scope;
  if (allDomains) {
    scope = await getMarketScopeForAllDomains(seller.id);
  } else {
    const domain = await getPrimaryDomain(seller.id);
    if (!domain) {
      return NextResponse.json(
        { succeeded: false, data: null, errors: ['No primary domain'], message: 'No primary domain' },
        { status: 400 },
      );
    }
    scope = await getMarketScope(domain.categorySlug, seller.id);
  }

  const listings = await getMatchedListingsForExport(seller.id, scope);

  // 204 rather than an empty CSV: a file containing nothing but a header row
  // looks like a broken export. The client turns this into a message.
  if (listings.length === 0) return new NextResponse(null, { status: 204 });

  const csv = objectsToCsv(
    listings.map((m) => ({
      sellerProductTitle: m.sellerProductTitle,
      matchedTitle: m.matchedTitle,
      platform: m.matchedPlatformName ?? '',
      price: m.matchedPrice ?? '',
      currency: m.matchedCurrency ?? '',
      confidence: m.confidence,
      url: m.matchedUrl,
    })),
    [
      { key: 'sellerProductTitle', label: 'Your product' },
      { key: 'matchedTitle', label: 'Matched listing' },
      { key: 'platform', label: 'Platform' },
      { key: 'price', label: 'Price' },
      { key: 'currency', label: 'Currency' },
      { key: 'confidence', label: 'Match confidence' },
      { key: 'url', label: 'URL' },
    ],
  );

  const filename = `${allDomains ? 'all-products' : 'primary-domain'}-matched-listings-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
