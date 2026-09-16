import { NextRequest } from 'next/server';

import { detectCompetitorPriceAnomalies } from '@/lib/market-intel/market/anomalies';
import { getStockOuts } from '@/lib/market-intel/market/market-insights';
import {
  mobileError,
  mobileOk,
  requireMobileCategory,
  requireMobileSeller,
} from '@/lib/mobile/respond';

// What CHANGED in the category, as opposed to /competitors, which is the
// static picture of who is in it.
//
// Two different signals under one endpoint because they answer the same
// question for a seller holding a phone - "is there something to act on
// right now?" - and the mockup shows them as two sections of one screen.
// Splitting them would cost a second round trip to render one scroll.
//
// Premium, matching desktop. Both halves come from anomaly_detection
// territory, so unlike /market there is no free-tier remainder to serve and
// the gate sits on the whole endpoint rather than on one block inside it.

// The stock-out list is ranked longest-out-first by getStockOuts, so this
// cap takes the top of that ranking rather than an arbitrary slice. Ten
// fills a phone section; a seller who wants the full list has the desktop
// Market page. Anomalies carry their own cap of 50 inside the detector.
const STOCK_OUT_LIMIT = 10;

export async function GET(request: NextRequest) {
  const auth = await requireMobileSeller(request, 'anomaly_detection');
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  const categorySlug = request.nextUrl.searchParams.get('categorySlug');
  const resolved = await requireMobileCategory(seller.id, categorySlug);
  if ('response' in resolved) return resolved.response;
  const { domain } = resolved;

  let stockOuts;
  let anomalies;
  try {
    [stockOuts, anomalies] = await Promise.all([
      getStockOuts(domain.categorySlug, STOCK_OUT_LIMIT, seller.reportingCurrency),
      detectCompetitorPriceAnomalies(domain.categorySlug, seller.reportingCurrency),
    ]);
  } catch {
    return mobileError('Could not load competitor moves', 500);
  }

  return mobileOk({
    categorySlug: domain.categorySlug,
    categoryName: domain.categoryName,
    currency: seller.reportingCurrency,

    // Passed through field for field. `duration` in particular is handed
    // over as the { days, confirmed } pair rather than the formatted
    // sentence formatStockOutDuration() produces for the web: "Out 13+ days"
    // is a string a phone cannot localise or shorten to fit a badge, and
    // the distinction the pair encodes - measured versus floor - is the
    // whole point of the field. See stock-out-duration.ts.
    stockOuts,

    // Already sorted by |pctChange| and capped at 50 by the detector, and
    // already filtered to moves that held across two baselines. Nothing is
    // re-ranked here; a client that re-sorts by raw percentage would undo
    // the IQR ranking that makes a 5% move in a stable category outrank a
    // 20% move in a volatile one.
    anomalies,
  });
}
