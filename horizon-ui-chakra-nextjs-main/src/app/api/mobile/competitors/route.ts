import { getCompetitorLandscape } from '@/lib/market-intel/market/competitors';
import { getPrimaryDomain } from '@/lib/market-intel/seller/seller';
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
    // A single-retailer platform is now a named competitor in its own
    // right (migration 056), same as a marketplace seller - so an empty
    // list here means no in-scope, active listings from any tracked source
    // at all, not "sellers exist but can't be named". Field name kept as
    // no_named_sellers rather than renamed: it is already documented in the
    // mobile API guide, and the trigger condition (scorecards.length === 0)
    // is unchanged even though what causes it is now narrower.
    emptyReason: landscape.scorecards.length === 0 ? 'no_named_sellers' : null,
  });
}
