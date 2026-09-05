import {
  getCompetitorLandscape,
  getCompetitorLandscapeAllDomains,
  getCompetitorMatchCounts,
  getCompetitorMatchCountsAllDomains,
  getCompetitorOverlap,
  getCompetitorOverlapAllDomains,
} from '@/lib/market-intel/market/competitors';
import { hasFeature } from '@/lib/market-intel/core/entitlements';
import { getMarketScopeSummary } from '@/lib/market-intel/market/market-definition';
import { getCurrentSeller, getPrimaryDomain, listSellerDomainSlugs } from '@/lib/market-intel/seller/seller';

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
  // The two landscapes gate everything downstream (overlap/match counts are
  // skipped when there's nobody to compare against), so they resolve first -
  // but as a pair, not one after the other. Everything that doesn't depend
  // on them rides along in the same round.
  //
  // The matched-listings CSV payloads used to be computed here too - both
  // tabs' worth, up to MAX_MATCH_ROWS (2000) rows each - and passed to the
  // client as props so two export buttons could exist. That put two queries
  // in front of every render and up to 4000 rows into every page payload for
  // a file most visits never download. They now live behind
  // GET /api/competitors/matched-listings, fetched on click.
  const [trackedDomainCount, landscape, allLandscape, scopeSummary] = await Promise.all([
    seller ? listSellerDomainSlugs(seller.id).then((slugs) => slugs.length) : 0,
    domain && seller && hasAccess
      ? getCompetitorLandscape(domain.categorySlug, reportingCurrency, seller.id)
      : null,
    seller && hasAccess ? getCompetitorLandscapeAllDomains(seller.id, reportingCurrency) : null,
    domain && seller ? getMarketScopeSummary(domain.categorySlug, domain.categoryName, seller.id) : null,
  ]);

  // Overlap is the expensive half (in-process title matching), so it is only
  // computed once the landscape has found someone to compare against. Match
  // counts are a cheap indexed count gated the same way - no point running
  // either on an empty scorecard page. Primary and all-domains variants of
  // both run together rather than in four separate awaits.
  const [overlap, matchCounts, allOverlap, allMatchCounts] = await Promise.all([
    domain && seller && hasAccess && landscape && landscape.scorecards.length > 0
      ? getCompetitorOverlap(seller.id, domain.categorySlug, reportingCurrency).then((m) => Array.from(m.values()))
      : [],
    domain && seller && hasAccess && landscape && landscape.scorecards.length > 0
      ? getCompetitorMatchCounts(seller.id, domain.categorySlug).then((m) => Array.from(m.values()))
      : [],
    seller && hasAccess && allLandscape && allLandscape.scorecards.length > 0
      ? getCompetitorOverlapAllDomains(seller.id, reportingCurrency).then((m) => Array.from(m.values()))
      : [],
    seller && hasAccess && allLandscape && allLandscape.scorecards.length > 0
      ? getCompetitorMatchCountsAllDomains(seller.id).then((m) => Array.from(m.values()))
      : [],
  ]);

  return (
    <CompetitorsView
      hasAccess={hasAccess}
      categoryName={domain?.categoryName ?? null}
      trackedDomainCount={trackedDomainCount}
      reportingCurrency={reportingCurrency}
      landscape={landscape}
      overlap={overlap}
      matchCounts={matchCounts}
      scopeSummary={scopeSummary}
      allLandscape={allLandscape}
      allOverlap={allOverlap}
      allMatchCounts={allMatchCounts}
    />
  );
}
