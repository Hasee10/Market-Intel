import 'server-only';

import { getCompetitorLandscape } from '@/lib/market-intel/market/competitors';
import { getMarketScope } from '@/lib/market-intel/market/market-definition';
import { createClient } from '@/lib/supabase/server';

// Estimated share of a market, by listings.
//
// "Market share" on the product notes (2026-09-18). The honest version of
// that number from data that exists is a LISTING share: the seller's
// active catalogue in this category, against every active listing the
// scraper sees in the same category on the platforms the seller has put in
// scope. It is not a revenue share (nobody publishes competitor revenue) and
// not a sales share (sold counts exist on one platform and only for
// listings, not sellers). The response names it as a listing share and
// says how many sources and listings it was measured against, because a
// share with no denominator stated is a number a seller cannot trust.
//
// Two figures, deliberately kept apart:
//
//   listingShare        - your listings / (market listings + yours). The
//                         seller's own catalogue is not in market_products
//                         (that table is what the scraper sees on other
//                         sites), so it is added to the denominator: "if
//                         your shelf sat beside everything we scraped, this
//                         much of the aisle is yours".
//   rank among named    - where the seller's catalogue size would place them
//                         among the competitors the scraper can actually
//                         name (Daraz attributes listings to a seller; most
//                         single-retailer sites are one seller). This is the
//                         paid competitor_intel view, gated the same way the
//                         Competitors page gates it. Free tier gets the share
//                         and a count of named competitors, not their names.
//
// getMarketScope is cache()d, so calling it here alongside the rest of the
// Market page costs nothing extra in the same request.

export type NamedCompetitorShare = {
  name: string;
  platformName: string;
  skuCount: number;
  /** skuCount / (identified SKUs + seller's listings), percent. */
  share: number;
};

export type MarketShare = {
  categoryName: string;
  sellerListings: number;
  marketListings: number;
  /** Percent. */
  listingShare: number;
  platformsInScope: number;
  /** Named sellers the scraper attributes in-scope listings to. */
  namedCompetitorCount: number;
  /** Top named competitors by catalogue size. Empty unless includeNamed. */
  topNamed: NamedCompetitorShare[];
  /** 1-based rank of the seller among named competitors by catalogue size. Null unless includeNamed and there is at least one. */
  sellerRankAmongNamed: number | null;
  caveats: string[];
};

export async function getMarketShare(
  sellerId: string,
  sellerCategoryId: string,
  sellerCategorySlug: string,
  categoryName: string,
  reportingCurrency: string,
  includeNamed: boolean,
): Promise<MarketShare | null> {
  const scope = await getMarketScope(sellerCategorySlug, sellerId);
  if (scope.categorySlugs.length === 0 || scope.activePlatformIds.length === 0) return null;

  const supabase = await createClient();

  const [marketRes, sellerRes, landscape] = await Promise.all([
    supabase
      .from('market_products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .in('category_slug', scope.categorySlugs)
      .in('platform_id', scope.activePlatformIds),
    supabase
      .from('seller_products')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .eq('category_id', sellerCategoryId)
      .eq('is_active', true),
    getCompetitorLandscape(sellerCategorySlug, reportingCurrency, sellerId),
  ]);

  if (marketRes.error) throw new Error(marketRes.error.message);
  if (sellerRes.error) throw new Error(sellerRes.error.message);

  const marketListings = marketRes.count ?? 0;
  const sellerListings = sellerRes.count ?? 0;
  const denominator = marketListings + sellerListings;
  const listingShare = denominator === 0 ? 0 : Number(((sellerListings / denominator) * 100).toFixed(1));

  const scorecards = [...landscape.scorecards].sort((a, b) => b.skuCount - a.skuCount);
  const namedCompetitorCount = scorecards.length;

  let topNamed: NamedCompetitorShare[] = [];
  let sellerRankAmongNamed: number | null = null;
  if (includeNamed && scorecards.length > 0) {
    const namedDenominator = landscape.identifiedSkuCount + sellerListings;
    topNamed = scorecards.slice(0, 5).map((c) => ({
      name: c.name,
      platformName: c.platformName,
      skuCount: c.skuCount,
      share: namedDenominator === 0 ? 0 : Number(((c.skuCount / namedDenominator) * 100).toFixed(1)),
    }));
    // Position the seller would hold if inserted into the sorted list.
    sellerRankAmongNamed = scorecards.filter((c) => c.skuCount > sellerListings).length + 1;
  }

  const caveats = [
    `Listing share, not revenue or sales share: your ${sellerListings} active products in ${categoryName} against ${marketListings.toLocaleString()} active listings scraped across ${scope.activePlatformIds.length} platform${scope.activePlatformIds.length === 1 ? '' : 's'} in your market definition.`,
    'Your own catalogue is not among the scraped listings, so it is added to the total - the share is "if your shelf sat beside everything we see".',
  ];
  if (!includeNamed && namedCompetitorCount > 0) {
    caveats.push(`${namedCompetitorCount} named competitors are in this market. Their names and your rank among them are part of the Paid plan.`);
  }
  if (includeNamed && namedCompetitorCount === 0) {
    caveats.push('No platform in your scope attributes listings to a named seller, so there is no competitor ranking here.');
  }

  return {
    categoryName,
    sellerListings,
    marketListings,
    listingShare,
    platformsInScope: scope.activePlatformIds.length,
    namedCompetitorCount,
    topNamed,
    sellerRankAmongNamed,
    caveats,
  };
}
