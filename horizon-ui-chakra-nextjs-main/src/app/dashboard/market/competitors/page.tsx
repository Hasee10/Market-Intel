import {
  getCompetitorLandscape,
  getCompetitorLandscapeAllDomains,
  getCompetitorMatchCounts,
  getCompetitorMatchCountsAllDomains,
  getCompetitorOverlap,
  getCompetitorOverlapAllDomains,
  getMatchedListingsForExport,
} from '@/lib/market-intel/competitors';
import { hasFeature } from '@/lib/market-intel/entitlements';
import { getMarketScope, getMarketScopeForAllDomains, getMarketScopeSummary } from '@/lib/market-intel/market-definition';
import { getCurrentSeller, getPrimaryDomain, listSellerDomainSlugs } from '@/lib/market-intel/seller';

import CompetitorsView from './CompetitorsView';

// ROADMAP.md C1. Server Component: fetches, then hands plain data to the
// client view - same split as every other page here. Fetches both the
// primary-domain view (unchanged) and the "All My Products" view (aggregated
// across every tracked domain) up front, so switching tabs client-side needs
// no extra round-trip - matches this page's existing fetch-then-render
// pattern rather than introducing a new API route.
export default async function CompetitorsPage() {
  const seller = await getCurrentSeller();
  const domain = seller ? await getPrimaryDomain(seller.id) : null;
  const planTier = seller?.planTier ?? 'free';
  const hasAccess = hasFeature(planTier, 'competitor_intel');
  const reportingCurrency = seller?.reportingCurrency ?? 'PKR';
  const trackedDomainCount = seller ? (await listSellerDomainSlugs(seller.id)).length : 0;

  const landscape =
    domain && seller && hasAccess
      ? await getCompetitorLandscape(domain.categorySlug, reportingCurrency, seller.id)
      : null;

  // Overlap is the expensive half (in-process title matching), so it is only
  // computed once the landscape has found someone to compare against.
  const overlap =
    domain && seller && hasAccess && landscape && landscape.scorecards.length > 0
      ? Array.from((await getCompetitorOverlap(seller.id, domain.categorySlug, reportingCurrency)).values())
      : [];

  // Cheap indexed count, gated the same as overlap - no point running it on
  // an empty scorecard page.
  const matchCounts =
    domain && seller && hasAccess && landscape && landscape.scorecards.length > 0
      ? Array.from((await getCompetitorMatchCounts(seller.id, domain.categorySlug)).values())
      : [];

  const scopeSummary =
    domain && seller ? await getMarketScopeSummary(domain.categorySlug, domain.categoryName, seller.id) : null;

  const allLandscape =
    seller && hasAccess ? await getCompetitorLandscapeAllDomains(seller.id, reportingCurrency) : null;

  const allOverlap =
    seller && hasAccess && allLandscape && allLandscape.scorecards.length > 0
      ? Array.from((await getCompetitorOverlapAllDomains(seller.id, reportingCurrency)).values())
      : [];

  const allMatchCounts =
    seller && hasAccess && allLandscape && allLandscape.scorecards.length > 0
      ? Array.from((await getCompetitorMatchCountsAllDomains(seller.id)).values())
      : [];

  // CSV export payloads - computed here (not client-side) since they need
  // the same server-only Supabase access every other fetch on this page
  // uses. Both are small enough to hand to the client whole rather than
  // wiring a dedicated export API route.
  const primaryMatchedListings =
    domain && seller && hasAccess ? await getMatchedListingsForExport(seller.id, await getMarketScope(domain.categorySlug, seller.id)) : [];
  const allMatchedListings =
    seller && hasAccess ? await getMatchedListingsForExport(seller.id, await getMarketScopeForAllDomains(seller.id)) : [];

  return (
    <CompetitorsView
      hasAccess={hasAccess}
      categoryName={domain?.categoryName ?? null}
      trackedDomainCount={trackedDomainCount}
      reportingCurrency={reportingCurrency}
      landscape={landscape}
      overlap={overlap}
      matchCounts={matchCounts}
      matchedListings={primaryMatchedListings}
      scopeSummary={scopeSummary}
      allLandscape={allLandscape}
      allOverlap={allOverlap}
      allMatchCounts={allMatchCounts}
      allMatchedListings={allMatchedListings}
    />
  );
}
