'server-only';

import { createClient } from '@/lib/supabase/server';
import type { FxRates } from '@/lib/market-intel/fx';
import { getCategoryPricing } from '@/lib/market-intel/market/category-pricing';
import { getMarketScope } from '@/lib/market-intel/market/market-definition';
import { safeRatio } from '../metrics/growth';
import type { MarketplacePerformanceSection, PricePositioningSection } from '../schema';

const TREND_LOOKBACK_DAYS = 90;

export interface MarketplaceAndPricingResult {
  marketplacePerformance: MarketplacePerformanceSection | null;
  pricePositioning: PricePositioningSection | null;
  categorySlug: string | null;
}

export async function collectMarketplaceAndPricing(
  categorySlug: string | null,
  medianSellPrice: number | null,
  targetCurrency: string,
  fxRates: FxRates,
  asOf: string,
): Promise<MarketplaceAndPricingResult> {
  if (!categorySlug) {
    return { marketplacePerformance: null, pricePositioning: null, categorySlug: null };
  }

  const scope = await getMarketScope(categorySlug);
  if (scope.categorySlugs.length === 0) {
    return { marketplacePerformance: null, pricePositioning: null, categorySlug };
  }

  const [categoryPricing, trend] = await Promise.all([
    getCategoryPricing(categorySlug, targetCurrency),
    fetchPriceTrend(scope.categorySlugs, scope.activePlatformIds, targetCurrency, fxRates),
  ]);

  if (!categoryPricing) {
    return { marketplacePerformance: null, pricePositioning: null, categorySlug };
  }

  const priceIndexRatio = safeRatio(medianSellPrice ?? 0, categoryPricing.median);
  const priceIndex = medianSellPrice != null && priceIndexRatio != null ? priceIndexRatio * 100 : null;

  const marketplacePerformance: MarketplacePerformanceSection = {
    scope: { categorySlugs: scope.categorySlugs, platformNames: categoryPricing.samplePlatforms },
    priceIndex: priceIndex != null ? { value: priceIndex, source: 'public_marketplace', asOf } : null,
    // Per-platform SKU overlap/price-gap needs the same title-matching work
    // getCompetitorOverlap() already does per-competitor - not duplicated
    // here; competitorBenchmarks (a separate section) carries that detail
    // for sources that name a seller. A plain per-platform breakdown
    // without seller identity is directional at best, so it's left empty
    // rather than fabricated from the aggregate stats alone.
    perPlatform: [],
  };

  // Only build a recommended band when p25/p75 exist - migration 026 moved
  // the sample-size threshold into market_scope_price_stats itself (a band
  // from 3 listings is a guess dressed up as a recommendation), so this
  // trusts that single source of truth instead of duplicating a magic
  // threshold number at this layer, which could drift out of sync with the
  // SQL function's own.
  const recommendedBand =
    categoryPricing.p25 != null && categoryPricing.p75 != null
      ? { low: categoryPricing.p25, high: categoryPricing.p75 }
      : null;

  const percentile = computePercentile(medianSellPrice, categoryPricing);

  const pricePositioning: PricePositioningSection | null =
    medianSellPrice == null
      ? null
      : {
          yourMedianPrice: { value: medianSellPrice, source: 'seller_private', asOf },
          marketMedian: { value: categoryPricing.median, source: 'public_marketplace', asOf },
          percentile,
          recommendedBand,
          trend: trend.length >= 2 ? trend : null,
        };

  return { marketplacePerformance, pricePositioning, categorySlug };
}

export function computePercentile(
  price: number | null,
  pricing: { minPrice: number; p25: number | null; median: number; p75: number | null; maxPrice: number },
): number | null {
  if (price == null) return null;
  // Coarse interpolation across the known percentile stops (10/25/50/75/90-ish
  // via min/max as soft bounds) - deliberately not a fabricated exact percentile,
  // since only as many real stops exist as the source data actually supports.
  // p25/p75 are null below migration 026's sample-size threshold - drop to a
  // 3-point min/median/max interpolation rather than letting a null flow into
  // the arithmetic below and produce NaN (null - number is NaN in JS, not 0).
  const stops: [number, number][] = [
    [pricing.minPrice, 5],
    ...(pricing.p25 != null ? ([[pricing.p25, 25]] as [number, number][]) : []),
    [pricing.median, 50],
    ...(pricing.p75 != null ? ([[pricing.p75, 75]] as [number, number][]) : []),
    [pricing.maxPrice, 95],
  ];
  if (price <= stops[0][0]) return stops[0][1];
  if (price >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [lowPrice, lowPct] = stops[i];
    const [highPrice, highPct] = stops[i + 1];
    if (price >= lowPrice && price <= highPrice) {
      const span = highPrice - lowPrice;
      if (span <= 0) return lowPct;
      return Math.round(lowPct + ((price - lowPrice) / span) * (highPct - lowPct));
    }
  }
  return null;
}

async function fetchPriceTrend(
  categorySlugs: string[],
  platformIds: string[],
  targetCurrency: string,
  fxRates: FxRates,
): Promise<{ date: string; medianPrice: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('market_scope_price_trend', {
    p_category_slugs: categorySlugs,
    p_platform_ids: platformIds,
    p_target_currency: targetCurrency,
    p_rates: fxRates,
    p_lookback_days: TREND_LOOKBACK_DAYS,
  });
  if (error || !data) return [];
  return (data as { bucket_date: string; median_price: number | string | null }[])
    .filter((row) => row.median_price != null)
    .map((row) => ({ date: row.bucket_date, medianPrice: Number(row.median_price) }));
}
