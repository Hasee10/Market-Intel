import { NextRequest } from 'next/server';

import { hasFeature } from '@/lib/market-intel/core/entitlements';
import {
  PRICE_POSITION_BAND_LABEL,
  summarisePortfolioBands,
} from '@/lib/market-intel/core/price-position-bands';
import { getCategoryPricing } from '@/lib/market-intel/market/category-pricing';
import { getCategoryPriceForecast } from '@/lib/market-intel/market/forecast';
import { getPortfolioPricePositions } from '@/lib/market-intel/seller/portfolio-pricing';
import {
  mobileError,
  mobileOk,
  requireMobileCategory,
  requireMobileSeller,
} from '@/lib/mobile/respond';

// The whole Market screen in one request: what this category costs, where
// it is heading, and where the seller's own prices sit inside it.
//
// Three desktop widgets collapsed into one response for the same reason
// /pulse collapses the home screen - a phone pays latency per round trip,
// and three spinners stacked down one screen read as a slow app even when
// each call is fast.
//
// The forecast block is premium; the rest is not. That split is desktop's,
// not a mobile decision - see entitlements.ts. It is expressed as a null
// block rather than a 403 on the whole endpoint, because the price stats
// underneath it are free-tier and a free seller is entitled to see them.

// Bands are computed over the whole catalogue (getPortfolioPricePositions
// covers every category, capped at 200 products), then narrowed to the
// category on screen. Everything else in this response is about one
// category, so mixing in products judged against a different median would
// make the "75 of 87" headline mean nothing.
function isInCategory(slug: string) {
  return (p: { categorySlug: string | null }) => p.categorySlug === slug;
}

export async function GET(request: NextRequest) {
  const auth = await requireMobileSeller(request);
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  const categorySlug = request.nextUrl.searchParams.get('categorySlug');
  const resolved = await requireMobileCategory(seller.id, categorySlug);
  if ('response' in resolved) return resolved.response;
  const { domain } = resolved;

  const canForecast = hasFeature(seller.planTier as never, 'forecasting');

  let pricing;
  let forecast;
  let positions;
  try {
    [pricing, forecast, positions] = await Promise.all([
      getCategoryPricing(domain.categorySlug, seller.reportingCurrency),
      // Not requested at all when the plan doesn't include it. Fetching and
      // then discarding would run a regression over a month of scraped
      // history to throw the result away.
      canForecast
        ? getCategoryPriceForecast(domain.categorySlug, seller.reportingCurrency)
        : Promise.resolve(null),
      getPortfolioPricePositions(seller.id, seller.reportingCurrency),
    ]);
  } catch {
    return mobileError('Could not load market data', 500);
  }

  const inCategory = positions.filter(isInCategory(domain.categorySlug));
  const bands = summarisePortfolioBands(inCategory);

  return mobileOk({
    categorySlug: domain.categorySlug,
    categoryName: domain.categoryName,
    currency: seller.reportingCurrency,

    // Null when the category has nothing scraped yet. p25/p75 inside it can
    // be null independently, below the 15-row sample floor - those are two
    // different "not available"s and the client renders a dash for both.
    pricing,

    // Null for two different reasons that the client handles identically
    // (hide the card): the plan doesn't include forecasting, or there are
    // under 5 data points to fit a line through. Not distinguished on
    // purpose - a free seller being told "upgrade to see a forecast we
    // couldn't compute anyway" is a worse experience than no card.
    forecast,

    pricePosition: {
      totalProducts: inCategory.length,
      // The mockup's "75 of 87" headline. Counted here rather than left to
      // the client so both ends agree on what "far" means - it is the two
      // outer bands, at the 25% threshold price-position-bands.ts sets.
      farFromMedianCount: inCategory.filter(
        (p) => p.band === 'far-above' || p.band === 'far-below',
      ).length,
      bands: bands.map((b) => ({
        band: b.band,
        label: PRICE_POSITION_BAND_LABEL[b.band],
        count: b.count,
      })),
      // True when any row's own price was normalised for pack size. The
      // category median is NOT normalised - it is scraped as-is - so the
      // comparison is approximate whenever this is set, and the client is
      // told to say so rather than state the headline as fact.
      anyPackSizeAdjusted: inCategory.some((p) => p.perUnit),
    },
  });
}
