import {
  getMarketScope,
  getMarketScopeCoverage,
  getMarketScopeSummary,
  listTaxonomyPlatforms,
} from '@/lib/market-intel/market/market-definition';
import { resolveSelectedDomain, requireOnboardedSeller } from '@/lib/market-intel/seller/seller';

import MarketDefinitionEditor from './MarketDefinitionEditor';

// ROADMAP.md C2 / framework Block 1. Server Component: fetch here, render in
// the client editor, same split as every other page in this app.
//
// Respecting ?domain= matters more here than anywhere else: seller_market_
// definitions is keyed per category, but this editor only ever opened the
// primary domain, so a seller tracking three categories could scope exactly
// one of them and the other two were stuck on the default "everything"
// scope with no UI to narrow them.
export default async function MarketDefinitionPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain: domainSlug } = await searchParams;
  const seller = await requireOnboardedSeller();
  const domain = await resolveSelectedDomain(seller.id, domainSlug);

  // requireOnboardedSeller() already redirects when there is no primary
  // domain, and resolveSelectedDomain falls back to it, so this is type
  // narrowing rather than a real branch.
  if (!domain) return null;

  const scope = await getMarketScope(domain.categorySlug, seller.id);
  const [coverage, summary, platforms] = await Promise.all([
    getMarketScopeCoverage(scope),
    getMarketScopeSummary(domain.categorySlug, domain.categoryName, seller.id),
    listTaxonomyPlatforms(domain.categorySlug),
  ]);

  return (
    <MarketDefinitionEditor
      categorySlug={domain.categorySlug}
      categoryName={domain.categoryName}
      reportingCurrency={seller.reportingCurrency}
      definition={scope.definition}
      allSegments={scope.allSegments}
      platforms={platforms}
      coverage={coverage}
      summary={summary}
    />
  );
}
