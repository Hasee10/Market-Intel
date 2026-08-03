import { getCompetitorLandscape, getCompetitorOverlap } from '@/lib/market-intel/competitors';
import { hasFeature } from '@/lib/market-intel/entitlements';
import { getMarketScopeSummary } from '@/lib/market-intel/market-definition';
import { getCurrentSeller, getPrimaryDomain } from '@/lib/market-intel/seller';

import CompetitorsView from './CompetitorsView';

// ROADMAP.md C1. Server Component: fetches, then hands plain data to the
// client view - same split as every other page here.
export default async function CompetitorsPage() {
  const seller = await getCurrentSeller();
  const domain = seller ? await getPrimaryDomain(seller.id) : null;
  const planTier = seller?.planTier ?? 'free';
  const hasAccess = hasFeature(planTier, 'competitor_intel');
  const reportingCurrency = seller?.reportingCurrency ?? 'PKR';

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

  const scopeSummary =
    domain && seller ? await getMarketScopeSummary(domain.categorySlug, domain.categoryName, seller.id) : null;

  return (
    <CompetitorsView
      hasAccess={hasAccess}
      categoryName={domain?.categoryName ?? null}
      reportingCurrency={reportingCurrency}
      landscape={landscape}
      overlap={overlap}
      scopeSummary={scopeSummary}
    />
  );
}
