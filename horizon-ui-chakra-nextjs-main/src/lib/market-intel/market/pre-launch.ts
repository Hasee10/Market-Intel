'server-only';

import { getCategoryPricing, type CategoryPricing } from '@/lib/market-intel/market/category-pricing';
import { findTopSimilarCandidates } from '@/lib/market-intel/market/candidate-search';
import { getMarketScope } from '@/lib/market-intel/market/market-definition';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';
import {
  buildIdf,
  idfCosine,
  jaccard,
  matchStrength,
  tokenize,
  MIN_COMPETITOR_CONFIDENCE,
  type MatchStrength,
} from '@/lib/market-intel/core/similarity';
import { createClient } from '@/lib/supabase/server';

// "Should I stock this?" - the product-level counterpart to the Explore
// page's category-level browse.
//
// The distinction matters. Explore answers "what does the toys market look
// like"; this answers "what does THIS item sell for, who already sells it,
// and would I be walking into a crowd". A seller asks the second question
// at a supplier with a phone in their hand, which is why this is keyed on a
// plain title string rather than a seller_product_id: the whole point is
// that the product does not exist in their catalogue yet.
//
// Nothing here is new analysis. findTopSimilarCandidates already turns a
// title into ranked scraped listings, and market_scope_price_stats already
// computes a price distribution over a scope. This composes the two and
// draws the one conclusion neither can draw alone - where a proposed price
// would land against the market.

/** Below this many matched listings, the market read is too thin to lean on. */
const MIN_LISTINGS_FOR_CONFIDENCE = 5;

/** Matched listings kept for display. The rest still count toward the totals. */
const MAX_SAMPLE_LISTINGS = 8;

export type PreLaunchListing = {
  title: string;
  platformName: string | null;
  price: number | null;
  imageUrl: string | null;
  url: string;
  rating: number | null;
  soldCount: number | null;
  matchStrength: MatchStrength;
};

export type PreLaunchInsight = {
  /** Echoed back so a client rendering an async result can't mislabel it. */
  query: string;
  categorySlug: string;
  categoryName: string | null;
  currency: string;

  /** How many scraped listings matched the title well enough to count. */
  matchCount: number;
  /** Distinct named sellers across those matches - 0 on single-retailer-only markets. */
  competitorCount: number;
  /** Distinct platforms carrying a match. */
  platformCount: number;

  /**
   * Price distribution over the MATCHED listings, not the whole category -
   * this is the band for this product, which is the number a seller is
   * actually deciding against. Null when nothing matched.
   */
  matchedPriceBand: { min: number; median: number; max: number } | null;

  /** The wider category distribution, for context. Null when unscraped. */
  categoryPricing: CategoryPricing | null;

  /** Present only when the caller supplied an intended price. */
  pricePosition: {
    intendedPrice: number;
    /** Signed fraction against the matched median: -0.1 = 10% below it. */
    vsMatchedMedian: number;
    /** How many matched listings the seller would undercut at this price. */
    cheaperThanCount: number;
    verdict: 'below market' | 'at market' | 'above market';
  } | null;

  /**
   * Whether there is enough matched supply to treat any of the above as a
   * finding rather than a hint. Stated rather than hidden: a thin market is
   * itself worth knowing about, and silently returning confident-looking
   * numbers over three listings is how a seller gets burned.
   */
  hasEnoughData: boolean;

  listings: PreLaunchListing[];
};

/**
 * Builds the pre-launch read for a product title.
 *
 * `sellerId` is optional and, when absent, the scope falls back to the
 * category's default definition - correct for a category the seller does
 * not track, which is the common case here.
 */
export async function getPreLaunchInsight(
  title: string,
  categorySlug: string,
  reportingCurrency: string,
  options: { sellerId?: string; intendedPrice?: number | null; categoryName?: string | null } = {},
): Promise<PreLaunchInsight> {
  const { sellerId, intendedPrice = null, categoryName = null } = options;

  const empty: PreLaunchInsight = {
    query: title,
    categorySlug,
    categoryName,
    currency: reportingCurrency,
    matchCount: 0,
    competitorCount: 0,
    platformCount: 0,
    matchedPriceBand: null,
    categoryPricing: null,
    pricePosition: null,
    hasEnoughData: false,
    listings: [],
  };

  if (!title.trim()) return empty;

  const scope = await getMarketScope(categorySlug, sellerId);
  if (scope.categorySlugs.length === 0) return empty;

  const supabase = await createClient();

  const [candidates, fxRates, categoryPricing] = await Promise.all([
    findTopSimilarCandidates(supabase, scope.categorySlugs, scope.activePlatformIds, title),
    getLatestFxRates(),
    getCategoryPricing(categorySlug, reportingCurrency),
  ]);

  if (candidates.length === 0) return { ...empty, categoryPricing };

  // Same two-score treatment product-matching.ts uses: plain Jaccard decides
  // what counts as a match at all, IDF-weighted cosine decides how strong
  // each one is. Reusing both is what keeps a "Strong" badge here meaning
  // the same thing it means in the Competitors drawer.
  const queryTokens = tokenize(title);
  const candidateTokens = candidates.map((c) => tokenize(c.title));
  const idf = buildIdf([queryTokens, ...candidateTokens]);

  const matched = candidates
    .map((c, i) => ({
      candidate: c,
      confidence: jaccard(queryTokens, candidateTokens[i]),
      relevance: idfCosine(queryTokens, candidateTokens[i], idf),
      price:
        c.price != null ? convertCurrency(c.price, c.currency ?? 'PKR', reportingCurrency, fxRates) : null,
    }))
    // The same floor the Competitors drawer applies, imported rather than
    // restated - a divergence here would mean the two surfaces disagreed
    // about what counts as the same product.
    .filter((m) => m.confidence >= MIN_COMPETITOR_CONFIDENCE)
    .sort((a, b) => b.relevance - a.relevance);

  if (matched.length === 0) return { ...empty, categoryPricing };

  const prices = matched
    .map((m) => m.price)
    .filter((p): p is number => p != null)
    .sort((a, b) => a - b);

  const matchedPriceBand =
    prices.length > 0
      ? {
          min: prices[0],
          median: prices[Math.floor(prices.length / 2)],
          max: prices[prices.length - 1],
        }
      : null;

  const competitorCount = new Set(
    matched.map((m) => m.candidate.sellerExternalId).filter((id): id is string => Boolean(id)),
  ).size;
  const platformCount = new Set(matched.map((m) => m.candidate.platformId)).size;

  const pricePosition =
    intendedPrice != null && matchedPriceBand != null && matchedPriceBand.median > 0
      ? (() => {
          const delta = (intendedPrice - matchedPriceBand.median) / matchedPriceBand.median;
          return {
            intendedPrice,
            vsMatchedMedian: delta,
            cheaperThanCount: prices.filter((p) => p > intendedPrice).length,
            // 5% either side of the median is "at market" - inside the
            // noise of a title-similarity match, so calling it above or
            // below would be false precision.
            verdict:
              Math.abs(delta) < 0.05
                ? ('at market' as const)
                : delta < 0
                  ? ('below market' as const)
                  : ('above market' as const),
          };
        })()
      : null;

  return {
    query: title,
    categorySlug,
    categoryName,
    currency: reportingCurrency,
    matchCount: matched.length,
    competitorCount,
    platformCount,
    matchedPriceBand,
    categoryPricing,
    pricePosition,
    hasEnoughData: matched.length >= MIN_LISTINGS_FOR_CONFIDENCE,
    listings: matched.slice(0, MAX_SAMPLE_LISTINGS).map((m) => ({
      title: m.candidate.title,
      platformName: m.candidate.platformName,
      price: m.price,
      imageUrl: m.candidate.imageUrl,
      url: m.candidate.url,
      rating: m.candidate.rating,
      soldCount: m.candidate.soldCount,
      matchStrength: matchStrength(m.relevance),
    })),
  };
}
