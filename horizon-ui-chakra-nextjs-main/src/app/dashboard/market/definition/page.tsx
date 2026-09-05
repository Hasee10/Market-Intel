import {
  getMarketScope,
  getMarketScopeCoverage,
  getMarketScopeSummary,
  listTaxonomyPlatforms,
} from '@/lib/market-intel/market/market-definition';
import { getPrimaryDomain, requireOnboardedSeller } from '@/lib/market-intel/seller/seller';

import MarketDefinitionEditor from './MarketDefinitionEditor';

// ROADMAP.md C2 / framework Block 1. Server Component: fetch here, render in
// the client editor, same split as every other page in this app.
export default async function MarketDefinitionPage() {
  const seller = await requireOnboardedSeller();
  const domain = await getPrimaryDomain(seller.id);

  // requireOnboardedSeller() already redirects when there is no primary
  // domain, so this is type narrowing rather than a real branch.
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
