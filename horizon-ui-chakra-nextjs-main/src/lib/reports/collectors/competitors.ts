'server-only';

import type { FxRates } from '@/lib/market-intel/fx';
import { getCompetitorLandscape } from '@/lib/market-intel/competitors';
import type { CompetitorBenchmarksSection } from '../schema';

const MAX_SCORECARD_ROWS = 12;

// Reuses the existing, already-correct C1 competitor entity work
// (getCompetitorLandscape -> market_competitor_scorecards) rather than
// re-deriving anything - that function already handles the one honest limit
// that matters here: only sources naming a seller (currently Daraz) can
// populate this at all.
export async function collectCompetitorBenchmarks(
  categorySlug: string | null,
  targetCurrency: string,
  sellerId: string,
  asOf: string,
  fxRates: FxRates,
): Promise<CompetitorBenchmarksSection | null> {
  if (!categorySlug) return null;

  const landscape = await getCompetitorLandscape(categorySlug, targetCurrency, sellerId, fxRates);
  if (landscape.scorecards.length === 0) return null; // no named-seller source in this category - omit, don't fake it

  // A competitor row with no priced listing at all can't carry a Sourced<number>
  // medianPrice (the schema requires a real value, not a fabricated 0) - dropped
  // from the table rather than faked. Rare in practice (sku_count > 0 with zero
  // priced listings), but real enough to guard rather than assume away.
  const scorecards = landscape.scorecards
    .filter((s) => s.medianPrice != null)
    .slice(0, MAX_SCORECARD_ROWS)
    .map((s) => ({
      competitorName: s.name,
      platformName: s.platformName,
      skuCount: s.skuCount,
      medianPrice: { value: s.medianPrice as number, source: 'public_marketplace' as const, asOf },
      inStockRate: s.inStockRate ?? 0,
      repricingRate: s.priceChangeRate,
    }));

  if (scorecards.length === 0) return null;

  return {
    scorecards,
    marketDefinitionSummary: `${landscape.platformsWithIdentity.join(', ')} · ${landscape.identifiedSkuCount} identified SKUs, ${landscape.anonymousSkuCount} unattributed`,
  };
}
