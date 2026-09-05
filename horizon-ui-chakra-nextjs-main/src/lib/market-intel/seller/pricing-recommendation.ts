'server-only';

import { createClient } from '@/lib/supabase/server';
import { getCategoryPricing, type CategoryPricing } from '@/lib/market-intel/market/category-pricing';
import { getMarketScope } from '@/lib/market-intel/market/market-definition';
import { findTopProductMatches } from '@/lib/market-intel/market/product-matching';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';

// Rule-based, not ML: with a handful of scraped competitor data points per
// category, a real elasticity/demand model would be fitting noise, not
// signal. A margin-floor + competitor-band rule is transparent, defensible,
// and correct at this data volume - see new_implementation_doc.md Phase 4.
const MIN_MARGIN_PCT = 0.15;
const MATCH_BAND_PCT = 0.05;
// Same near-zero-baseline guard as lib/reports/metrics/growth.ts - a
// product priced at literally Rs 0 (bad data entry, a free promo item)
// isn't something to compute a "recommended price" percentage change
// against; skipped rather than producing a divide-by-near-zero diffPct.
const MIN_BASELINE_PRICE = 0.01;

export type PricingRecommendation = {
  productId: string;
  productTitle: string;
  /**
   * The category whose competitor band this row was judged against - always
   * the product's own, never the market currently on screen. Surfaced so a
   * recommendation on a product outside the viewed domain can be read
   * without wondering which numbers produced it.
   */
  categorySlug: string;
  /**
   * How many active catalogue rows collapsed into this recommendation - 1 for
   * a normal product. Above 1 means the seller has duplicate entries for the
   * same item, which is worth telling them about: it is a data problem this
   * layer can only paper over, not fix.
   */
  duplicateEntries: number;
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

// Collapses duplicate catalogue rows so one product yields one recommendation.
//
// The duplicates are real and the database permits them: migration 035's
// unique indexes are (seller_id, sku) and (seller_id, import_key), and
// Postgres treats NULLs as distinct - so a product created by hand with
// neither field can be entered any number of times, exactly as 027 warned.
//
// Left alone this produced flatly contradictory advice: the same phone at the
// same price told to increase in one row and decrease in the next, because
// each row carried a different cost and so a different margin floor. Two
// answers is worse than one imperfect answer - the seller cannot act on
// either.
//
// The surviving row is the one with the HIGHEST cost. The margin floor has to
// clear the dearest copy the seller actually holds; taking the cheapest would
// recommend a price that loses money on the rest of the stock.
//
// Keyed on category plus normalised title, not title alone, so two genuinely
// different products that happen to share a name across categories stay
// separate. This is deliberately a display-layer repair - it makes the advice
// usable, but the duplicate rows are still there, which is why the count
// travels with the result instead of being quietly swallowed.
function dedupeCatalogueRows<T extends { title: string; cost_price: unknown }>(
  rows: T[],
  categoryOf: (row: T) => string | null,
): { product: T; duplicateEntries: number }[] {
  const byKey = new Map<string, { product: T; duplicateEntries: number }>();

  for (const row of rows) {
    const key = `${categoryOf(row) ?? ''}::${row.title.trim().toLowerCase().replace(/\s+/g, ' ')}`;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { product: row, duplicateEntries: 1 });
      continue;
    }
    seen.duplicateEntries += 1;
    if (Number(row.cost_price) > Number(seen.product.cost_price)) seen.product = row;
  }

  return [...byKey.values()];
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
  reportingCurrency: string,
): Promise<PricingRecommendation[]> {
  const supabase = await createClient();

  const [productsRes, matches, fxRates, scope] = await Promise.all([
    supabase
      // seller_categories(slug) is the fix for the bug this query used to
      // have: it selected every active product but priced them all against
      // ONE category's band - whichever market was being viewed. A seller
      // with beds and phones got both judged against, say, the beauty P75,
      // so every row cited the same competitor figure and the advice was
      // simply wrong for anything outside that one category.
      .from('seller_products')
      .select('id, title, cost_price, sell_price, currency, seller_categories(slug)')
      .eq('seller_id', sellerId)
      .eq('is_active', true)
      .not('cost_price', 'is', null)
      .not('sell_price', 'is', null),
    findTopProductMatches(sellerId, categorySlug, reportingCurrency),
    getLatestFxRates(),
    getMarketScope(categorySlug, sellerId),
  ]);

  if (productsRes.error || !productsRes.data) return [];

  const categoryOf = (row: { seller_categories?: unknown }): string | null => {
    const joined = row.seller_categories;
    const first = Array.isArray(joined) ? joined[0] : joined;
    return (first as { slug?: string } | null | undefined)?.slug ?? null;
  };

  // One band per distinct category the seller actually sells in, fetched
  // once rather than per product.
  const slugs = [...new Set(productsRes.data.map(categoryOf).filter((s): s is string => !!s))];
  const pricingBySlug = new Map<string, CategoryPricing | null>(
    await Promise.all(
      slugs.map(async (slug) => [slug, await getCategoryPricing(slug, reportingCurrency)] as const),
    ),
  );

  // Matches were computed against the viewed market's scope, so they are only
  // meaningful for products that actually sit inside it. Trusting one for a
  // product from another category would reintroduce the same class of bug in
  // a subtler form - a bed "matched" to a shampoo listing.
  const inMatchScope = new Set(scope.categorySlugs);
  const matchByProductId = new Map(matches.map((m) => [m.sellerProductId, m]));
  const recommendations: PricingRecommendation[] = [];

  for (const { product, duplicateEntries } of dedupeCatalogueRows(productsRes.data, categoryOf)) {
    // Products can each be in a different currency (seller_products.currency)
    // - convert to the seller's reporting currency, which categoryPricing is
    // already in, so cost/current/recommended prices compare correctly
    // against the competitor band below.
    const costPrice = convertCurrency(Number(product.cost_price), product.currency, reportingCurrency, fxRates);
    const currentPrice = convertCurrency(Number(product.sell_price), product.currency, reportingCurrency, fxRates);
    if (Math.abs(currentPrice) < MIN_BASELINE_PRICE) continue;

    // A product with no category mapped has no band of its own, and there is
    // no honest substitute - it used to inherit the viewed market's, which is
    // exactly the defect being fixed. Skipped instead.
    const productCategory = categoryOf(product);
    if (!productCategory) continue;
    const categoryPricing = pricingBySlug.get(productCategory);
    if (!categoryPricing) continue;

    const match = inMatchScope.has(productCategory) ? matchByProductId.get(product.id) : undefined;

    // Without a confident product match, the competitor band falls back to
    // the category's P25/P75 - which migration 026 now withholds below its
    // sample-size threshold (`strictNullChecks` is off project-wide, so
    // this must be checked explicitly, not trusted to a compile error).
    // No confident match AND no real percentile band means there is nothing
    // honest to recommend against - skip the product rather than silently
    // treating a missing bound as 0 (JS's Math.max(x, null) coerces null to
    // 0, which would recommend flooring the price at the cost-margin line).
    if (match?.matchedPrice == null && (categoryPricing.p25 == null || categoryPricing.p75 == null)) continue;

    const competitorLow = match?.matchedPrice != null ? match.matchedPrice * (1 - MATCH_BAND_PCT) : (categoryPricing.p25 as number);
    const competitorHigh = match?.matchedPrice != null ? match.matchedPrice * (1 + MATCH_BAND_PCT) : (categoryPricing.p75 as number);

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
      categorySlug: productCategory,
      duplicateEntries,
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
