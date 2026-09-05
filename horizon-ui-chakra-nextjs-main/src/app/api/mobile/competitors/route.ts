import { getCompetitorLandscape } from '@/lib/market-intel/competitors';
import { getPrimaryDomain } from '@/lib/market-intel/seller';
import { mobileOk, requireMobileSeller } from '@/lib/mobile/respond';

// The competitor snapshot: who is in this market and how they price.
//
// The desktop scorecard carries nine columns - assortment, repricing rate,
// stock reliability, overlap, tracked matches. This returns the three a
// seller can act on from a phone: who they are, how big they are, and
// whether they undercut. The rest is a laptop view, and saying so is
// better than shipping a nine-column table onto a 390px screen.

const MOBILE_COMPETITOR_LIMIT = 8;

export async function GET(request: Request) {
  const auth = await requireMobileSeller(request, 'competitor_intel');
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  const domain = await getPrimaryDomain(seller.id);

  if (!domain) {
    return mobileOk({
      categoryName: null,
      marketMedianPrice: null,
      currency: seller.reportingCurrency,
      competitors: [],
      // Said outright rather than returned as a bare empty list: "you have
      // not set a category" and "this market has no named sellers" are
      // different problems with different fixes.
      emptyReason: 'no_category',
    });
  }

  const landscape = await getCompetitorLandscape(
    domain.categorySlug,
    seller.reportingCurrency,
    seller.id,
  );

  return mobileOk({
    categoryName: domain.categoryName,
    marketMedianPrice: landscape.marketMedianPrice,
    currency: seller.reportingCurrency,
    competitors: landscape.scorecards.slice(0, MOBILE_COMPETITOR_LIMIT).map((c) => ({
      name: c.name,
      platformName: c.platformName,
      skuCount: c.skuCount,
      assortmentShare: c.assortmentShare,
      medianPrice: c.medianPrice,
      // Negative means they undercut the market median. The single most
      // useful number on this screen.
      priceIndex: c.priceIndex,
    })),
    // Only marketplaces carry seller identity; on single-retailer sources
    // the platform is the seller. An empty list there is a property of the
    // market, not a failure, and the app should say so.
    emptyReason: landscape.scorecards.length === 0 ? 'no_named_sellers' : null,
  });
}
