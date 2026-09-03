import { getCompetitorLandscape } from '@/lib/market-intel/competitors';
import { hasFeature } from '@/lib/market-intel/entitlements';
import { getMarketScopeSummary } from '@/lib/market-intel/market-definition';
import { getCurrentSeller, listCategories } from '@/lib/market-intel/seller';

import ExploreView from './ExploreView';

// Pre-launch category browser: lets a seller preview competitor pricing,
// ratings and sales volume for ANY category in the taxonomy, not just the
// ones they already track, before deciding to launch a product there. Both
// getCompetitorLandscape and getMarketScopeSummary already support running
// with no sellerId - that's the "default scope, no seller customization"
// mode, which is exactly right here since there is no seller-specific
// market definition to apply for a category the seller doesn't track.
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categorySlug } = await searchParams;

  const seller = await getCurrentSeller();
  const planTier = seller?.planTier ?? 'free';
  const hasAccess = hasFeature(planTier, 'competitor_intel');
  const reportingCurrency = seller?.reportingCurrency ?? 'PKR';

  const categories = await listCategories();
  const selectedCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;

  const [landscape, scopeSummary] =
    selectedCategory && hasAccess
      ? await Promise.all([
          getCompetitorLandscape(selectedCategory.slug, reportingCurrency),
          getMarketScopeSummary(selectedCategory.slug, selectedCategory.name),
        ])
      : [null, null];

  return (
    <ExploreView
      hasAccess={hasAccess}
      categories={categories}
      selectedCategorySlug={selectedCategory?.slug ?? null}
      selectedCategoryName={selectedCategory?.name ?? null}
      reportingCurrency={reportingCurrency}
      landscape={landscape}
      scopeSummary={scopeSummary}
    />
  );
}
