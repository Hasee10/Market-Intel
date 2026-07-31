'server-only';

import { createClient } from '@/lib/supabase/server';
import { getCategoryPricing } from '@/lib/market-intel/category-pricing';
import { findTopProductMatches } from '@/lib/market-intel/product-matching';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';

// Rule-based, not ML: with a handful of scraped competitor data points per
// category, a real elasticity/demand model would be fitting noise, not
// signal. A margin-floor + competitor-band rule is transparent, defensible,
// and correct at this data volume - see new_implementation_doc.md Phase 4.
const MIN_MARGIN_PCT = 0.15;
const MATCH_BAND_PCT = 0.05;

export type PricingRecommendation = {
  productId: string;
  productTitle: string;
  costPrice: number | null;
  currentPrice: number;
  recommendedPrice: number;
  competitorLow: number;
  competitorHigh: number;
  matchConfidence: number | null;
  marginConstrained: boolean;
  direction: 'increase' | 'decrease' | 'hold';
  rationale: string;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Recommends a price for each active product with both cost_price and
// sell_price set: stay inside the competitor band (a specific matched
// product's price +/-5% if we have a confident fuzzy match from
// product-matching.ts, otherwise the whole category's P25-P75), but never
// below cost_price * (1 + MIN_MARGIN_PCT). If the margin floor sits above
// the competitor band entirely, it's flagged "marginConstrained" - the
// seller can't be price-competitive here without selling at a thin margin,
// which is a real signal, not a bug to hide.
export async function getPricingRecommendations(
  sellerId: string,
  categorySlug: string,
  reportingCurrency = 'PKR',
): Promise<PricingRecommendation[]> {
  const supabase = await createClient();

  const [productsRes, categoryPricing, matches, fxRates] = await Promise.all([
    supabase
      .from('seller_products')
      .select('id, title, cost_price, sell_price, currency')
      .eq('seller_id', sellerId)
      .eq('is_active', true)
      .not('cost_price', 'is', null)
      .not('sell_price', 'is', null),
    getCategoryPricing(categorySlug, reportingCurrency),
    findTopProductMatches(sellerId, categorySlug, reportingCurrency),
    getLatestFxRates(),
  ]);

  if (productsRes.error || !productsRes.data || !categoryPricing) return [];

  const matchByProductId = new Map(matches.map((m) => [m.sellerProductId, m]));
  const recommendations: PricingRecommendation[] = [];

  for (const product of productsRes.data) {
    const productCurrency = product.currency ?? 'PKR';
    const costPrice = convertCurrency(Number(product.cost_price), productCurrency, reportingCurrency, fxRates);
    const currentPrice = convertCurrency(Number(product.sell_price), productCurrency, reportingCurrency, fxRates);
    const match = matchByProductId.get(product.id);

    const competitorLow = match?.matchedPrice != null ? match.matchedPrice * (1 - MATCH_BAND_PCT) : categoryPricing.p25;
    const competitorHigh = match?.matchedPrice != null ? match.matchedPrice * (1 + MATCH_BAND_PCT) : categoryPricing.p75;

    const minAllowed = costPrice * (1 + MIN_MARGIN_PCT);
    const marginConstrained = minAllowed > competitorHigh;

    let recommendedPrice: number;
    if (marginConstrained) {
      recommendedPrice = minAllowed;
    } else {
      recommendedPrice = Math.min(Math.max(currentPrice, Math.max(minAllowed, competitorLow)), competitorHigh);
    }
    recommendedPrice = round2(recommendedPrice);

    const diffPct = ((recommendedPrice - currentPrice) / currentPrice) * 100;
    const direction = Math.abs(diffPct) < 1 ? 'hold' : diffPct > 0 ? 'increase' : 'decrease';

    let rationale: string;
    if (marginConstrained) {
      rationale = `Competitor pricing (${round2(competitorHigh)}) is below your minimum ${Math.round(MIN_MARGIN_PCT * 100)}% margin over cost - can't match without thin margins.`;
    } else if (direction === 'hold') {
      rationale = match?.matchedPrice != null
        ? 'Already competitive against the closest matched competitor listing.'
        : 'Already within the category P25-P75 competitor band.';
    } else if (direction === 'decrease') {
      rationale = match?.matchedPrice != null
        ? `Priced above the closest matched competitor listing (${round2(match.matchedPrice)}).`
        : `Priced above the category P75 (${round2(categoryPricing.p75)}).`;
    } else {
      rationale = 'Room to raise price while staying inside the competitor band and improving margin.';
    }

    recommendations.push({
      productId: product.id,
      productTitle: product.title,
      costPrice,
      currentPrice,
      recommendedPrice,
      competitorLow: round2(competitorLow),
      competitorHigh: round2(competitorHigh),
      matchConfidence: match?.confidence ?? null,
      marginConstrained,
      direction,
      rationale,
    });
  }

  return recommendations.sort((a, b) => Math.abs(b.currentPrice - b.recommendedPrice) - Math.abs(a.currentPrice - a.recommendedPrice));
}
