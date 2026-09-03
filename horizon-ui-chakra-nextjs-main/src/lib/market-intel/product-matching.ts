'server-only';

import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMarketScope } from '@/lib/market-intel/market-definition';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';
import { findTopSimilarCandidates, findTopSimilarCandidatesBatch } from '@/lib/market-intel/candidate-search';
import { tokenize, jaccard, MIN_CONFIDENCE, MIN_COMPETITOR_CONFIDENCE } from '@/lib/market-intel/similarity';

// MVP-level matching: token-overlap (Jaccard) similarity on normalized
// titles. market_product_matches (009_product_matches.sql) already models
// confidence-scored product pairs, but only mobiles currently has a real
// matcher behind it. Extending that to fashion/other categories properly
// needs an embeddings-based fuzzy match on title+brand+price (a real model
// choice + likely a vector column) - deliberately not built here to avoid
// picking an embedding provider/infra without a decision. This gives sellers
// a directional "closest competitor listing" signal today using only
// string comparison, no new infra, while that decision is made.
//
// Candidate SELECTION (which rows even get Jaccard-scored) is a separate
// concern from confidence scoring, and used to be the real bug: both
// functions below used to fetch the whole category with no ORDER BY and a
// hard cap, which silently missed the right rows once a category grew past
// it (migrations/036_trigram_candidate_search.sql has the live example -
// "Zellbury Plain Shalwar Kameez" scored a fine 0.4 Jaccard by hand, but
// never got the chance because an unordered slice of a 9,000+ row category
// excluded every Zellbury product). candidate-search.ts's
// findTopSimilarCandidates() now does that selection in SQL via pg_trgm,
// index-backed and actually ranked - Jaccard below is unchanged, it just
// finally sees the right ~100 candidates instead of an arbitrary slice.

export type ProductMatch = {
  sellerProductId: string;
  sellerProductTitle: string;
  sellerPrice: number | null;
  matchedTitle: string;
  matchedPlatformName: string | null;
  matchedPrice: number | null;
  matchedUrl: string;
  confidence: number;
};

const MAX_SELLER_PRODUCTS = 20;

// Bounded on purpose: this recomputes similarity in-process on every call
// (no persisted match table yet), so it's capped to the seller's most
// recently updated active products, each scored against its own
// findTopSimilarCandidates() result (see candidate-search.ts) rather than
// one shared candidate pool - not run over the whole catalog.
export async function findTopProductMatches(
  sellerId: string,
  categorySlug: string,
  reportingCurrency = 'PKR',
): Promise<ProductMatch[]> {
  const scope = await getMarketScope(categorySlug, sellerId);
  if (scope.categorySlugs.length === 0) return [];

  const supabase = await createClient();

  const [sellerProductsRes, fxRates] = await Promise.all([
    supabase
      .from('seller_products')
      .select('id, title, sell_price, currency')
      .eq('seller_id', sellerId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(MAX_SELLER_PRODUCTS),
    getLatestFxRates(),
  ]);

  if (sellerProductsRes.error || !sellerProductsRes.data) return [];
  if (sellerProductsRes.data.length === 0) return [];

  // One RPC for all of them (migration 047), index-aligned with the seller
  // products above. Each product still gets its own ranked candidate list -
  // this changed how they're fetched, not what comes back - but as a single
  // round-trip instead of one per product.
  const perProductCandidates = await findTopSimilarCandidatesBatch(
    supabase,
    scope.categorySlugs,
    scope.activePlatformIds,
    sellerProductsRes.data.map((product) => product.title),
  );

  const matches: ProductMatch[] = [];

  sellerProductsRes.data.forEach((sellerProduct, index) => {
    const sellerTokens = tokenize(sellerProduct.title);
    const candidates = perProductCandidates[index];
    let best: (typeof candidates)[number] | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = jaccard(sellerTokens, tokenize(candidate.title));
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (best && bestScore >= MIN_CONFIDENCE) {
      matches.push({
        sellerProductId: sellerProduct.id,
        sellerProductTitle: sellerProduct.title,
        sellerPrice:
          sellerProduct.sell_price != null
            ? convertCurrency(Number(sellerProduct.sell_price), sellerProduct.currency ?? 'PKR', reportingCurrency, fxRates)
            : null,
        matchedTitle: best.title,
        matchedPlatformName: best.platformName,
        matchedPrice:
          best.price != null ? convertCurrency(best.price, best.currency ?? 'PKR', reportingCurrency, fxRates) : null,
        matchedUrl: best.url,
        confidence: Number(bestScore.toFixed(2)),
      });
    }
  });

  return matches.sort((a, b) => b.confidence - a.confidence);
}

// Per-product competitor view: one seller product in, top-N matching
// market_products rows out (instead of findTopProductMatches' whole-catalog,
// top-1-per-product shape). Kept as a separate type/function rather than
// reusing ProductMatch/findTopProductMatches - this answers a different
// question (competitor listings for one product a seller is looking at) and
// the two are allowed to diverge independently later.
//
// Matching model (revised 2026-08-28, after the price-bracket-only model
// below produced wrong matches in practice - a seller's diaper listing was
// being shown against baby toys/rattles/plates just because they shared a
// category and a price band): title similarity (Jaccard, MIN_COMPETITOR_
// CONFIDENCE) is now the hard filter deciding inclusion - price is no
// longer a filter at all, only a sort tiebreak among equally-confident
// matches. Results are then selected round-robin across platforms so one
// platform's denser candidate pool (e.g. ShoppersPK/Naheed vs Daraz in
// toys-and-baby, ~11x the row count) can't crowd out every other platform's
// genuine matches. Word-overlap similarity has a real ceiling for
// cross-brand matches of the same product type - see MIN_COMPETITOR_
// CONFIDENCE's comment in similarity.ts for why the threshold is set where
// it is and what that trade-off means.
//
// (Superseded decision, kept for history: this previously used same-
// category + seller's price +/-15% as the hard filter, with title
// similarity as ranking-only - reasoned via a GPU example where two
// differently-named GPUs at a similar price were judged more likely
// competitors than a same-named GPU at 3x the price. That still holds for
// genuinely fungible commodities, but doesn't generalize to categories like
// toys-and-baby where price bands are shared by completely unrelated
// products.)
//
// rating/ratingCount/soldCount are populated for Daraz today (a real
// multi-seller marketplace) and may be null everywhere else - never coerced
// to 0, callers must render nulls as "unknown", not "zero".
//
// Every call also persists its top matches into
// seller_product_competitor_matches (028_seller_product_competitor_matches.sql)
// so a specific competitor's price can be tracked over time and its
// decommission status (market_products.is_active, already maintained by the
// scraper) can be checked later - see persistCompetitorMatches() below.
// Persist-on-read, not a cron: history only needs to start when a seller
// actually looks at a product's competitors.
export type CompetitorListing = {
  matchedTitle: string;
  matchedPlatformName: string | null;
  matchedPrice: number | null;
  matchedUrl: string;
  rating: number | null;
  ratingCount: number | null;
  soldCount: number | null;
  confidence: number;
  /**
   * The seller's own price for the product being compared, in
   * reportingCurrency - the same number on every row, carried per-listing so
   * the drawer can show the comparison without a second fetch. Null when the
   * seller's product has no sell_price set.
   */
  sellerPrice: number | null;
  /**
   * How the seller's price compares to this listing, as a signed fraction of
   * the listing's price: -0.07 means the seller is 7% cheaper, +0.12 that
   * they are 12% pricier. Null when either side has no price, or when the
   * listing's price is 0 (no meaningful ratio). This is the "am I under or
   * over on this one" read the drawer exists to answer - it was computed and
   * then discarded before, so the drawer could only ever show two prices
   * side by side and leave the arithmetic to the seller.
   */
  priceDeltaPct: number | null;
  // Populated only for products a separate review-scraper job has already
  // visited (currently PriceOye only - see migrations/031). reviewCount is
  // the true total, not just topReviews.length; 0 means "none scraped yet
  // or genuinely zero," never distinguished further at this layer.
  reviewCount: number;
  topReviews: { author: string | null; rating: number | null; text: string }[];
};

// Capped small on purpose - this is a "does this listing have real reviews
// worth glancing at" signal in the drawer, not a review-browsing feature
// (explicitly descoped - see migrations/031's header comment).
const MAX_REVIEW_SNIPPETS = 2;

// Raised from 5 (2026-08-28): at 5, categories with a much denser in-bracket
// candidate pool on one platform (e.g. ShoppersPK/Naheed in toys-and-baby,
// ~1319 active rows vs Daraz's ~120) crowded out every other platform's
// listings entirely. 15 gives enough headroom for a smaller platform's
// closest matches to still surface without returning the whole candidate
// pool.
const MAX_COMPETITOR_MATCHES = 15;

export async function findCompetitorsForProduct(
  sellerId: string,
  sellerProductId: string,
  categorySlug: string,
  reportingCurrency = 'PKR',
  limit = MAX_COMPETITOR_MATCHES,
): Promise<CompetitorListing[]> {
  const scope = await getMarketScope(categorySlug, sellerId);
  if (scope.categorySlugs.length === 0) return [];

  const supabase = await createClient();

  const [sellerProductRes, fxRates] = await Promise.all([
    supabase
      .from('seller_products')
      .select('id, title, sell_price, currency')
      .eq('id', sellerProductId)
      .eq('seller_id', sellerId)
      .maybeSingle(),
    getLatestFxRates(),
  ]);

  if (sellerProductRes.error || !sellerProductRes.data) return [];

  const candidates = await findTopSimilarCandidates(
    supabase,
    scope.categorySlugs,
    scope.activePlatformIds,
    sellerProductRes.data.title,
  );
  if (candidates.length === 0) return [];

  const sellerTokens = tokenize(sellerProductRes.data.title);
  const sellerPrice =
    sellerProductRes.data.sell_price != null
      ? convertCurrency(Number(sellerProductRes.data.sell_price), sellerProductRes.data.currency ?? 'PKR', reportingCurrency, fxRates)
      : null;

  const scored = candidates
    .map((row) => {
      const matchedPrice =
        row.price != null ? convertCurrency(row.price, row.currency ?? 'PKR', reportingCurrency, fxRates) : null;
      return {
        marketProductId: row.id,
        matchedTitle: row.title,
        matchedPlatformName: row.platformName,
        matchedPrice,
        matchedUrl: row.url,
        rating: row.rating,
        ratingCount: row.ratingCount,
        soldCount: row.soldCount,
        confidence: Number(jaccard(sellerTokens, tokenize(row.title)).toFixed(2)),
        priceDiff: sellerPrice != null && matchedPrice != null ? Math.abs(matchedPrice - sellerPrice) : null,
        sellerPrice,
        // Signed, and divided by the listing's price rather than the
        // seller's, so "-7%" reads as "7% below what they charge".
        priceDeltaPct:
          sellerPrice != null && matchedPrice != null && matchedPrice !== 0
            ? (sellerPrice - matchedPrice) / matchedPrice
            : null,
      };
    })
    // Title similarity is the only hard filter now - price is never used to
    // exclude a candidate, only to break ties below among equally-confident
    // matches (see the header comment above for why this replaced the old
    // price-bracket filter).
    .filter((listing) => listing.confidence >= MIN_COMPETITOR_CONFIDENCE);
  sortByRelevance(scored);

  // selectDiverseTopN decides *which* listings survive (round-robin across
  // platforms, so one dense platform can't crowd the rest out). It must not
  // decide what order they render in: its output interleaves platforms, so
  // an 0.25-confidence listing from the second platform landed above a
  // 0.9-confidence one from the first. Re-sorting on the same keys the
  // candidate list was ranked by puts relevance back in charge of the
  // display while leaving the diversity guarantee intact.
  const top = sortByRelevance(selectDiverseTopN(scored, limit));

  // Deferred via after() rather than awaited: this only feeds a price/
  // decommission history feature (see the function's own comment below),
  // and its errors are already swallowed internally - awaiting it here just
  // added a DB round-trip's worth of latency to every single
  // Competitors-drawer response for no benefit the seller could see. A bare
  // un-awaited promise isn't safe here - Vercel's serverless runtime can
  // freeze the function once the response is sent and silently drop it;
  // after() is what guarantees this still runs to completion.
  after(() => persistCompetitorMatches(supabase, sellerId, sellerProductId, top));

  const reviewsByProduct = await fetchReviewSnippets(
    supabase,
    top.map((t) => t.marketProductId),
  );

  // priceDiff (absolute, unsigned) stays internal - it exists to break ties
  // in sortByRelevance. priceDeltaPct is the signed, display-facing version
  // and is returned.
  return top.map(({ priceDiff, marketProductId, ...listing }) => ({
    ...listing,
    reviewCount: reviewsByProduct.get(marketProductId)?.count ?? 0,
    topReviews: reviewsByProduct.get(marketProductId)?.snippets ?? [],
  }));
}

// Second query rather than a join on the main market_products select above -
// most candidates in `scored` never make it into `top`, so fetching reviews
// only for the final, already-diversity-selected N keeps this cheap. Missing
// entirely for a product just means "not scraped yet" (see migrations/031),
// same fail-soft posture as everything else in this function - a review
// query error never breaks the listings response.
async function fetchReviewSnippets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  marketProductIds: string[],
): Promise<Map<string, { count: number; snippets: CompetitorListing['topReviews'] }>> {
  const result = new Map<string, { count: number; snippets: CompetitorListing['topReviews'] }>();
  if (marketProductIds.length === 0) return result;

  const { data, error } = await supabase
    .from('market_product_reviews')
    .select('product_id, author, rating, review_text')
    .in('product_id', marketProductIds)
    .order('reviewed_at', { ascending: false });

  if (error || !data) return result;

  for (const row of data) {
    const entry = result.get(row.product_id) ?? { count: 0, snippets: [] };
    entry.count += 1;
    if (entry.snippets.length < MAX_REVIEW_SNIPPETS) {
      entry.snippets.push({
        author: row.author,
        rating: row.rating != null ? Number(row.rating) : null,
        text: row.review_text,
      });
    }
    result.set(row.product_id, entry);
  }
  return result;
}

// The one ranking rule for competitor listings: closest title match first,
// then (among equally-confident ones) the closest price. Applied twice - to
// the full candidate list before diversity selection, and again to the
// selected set before returning - so both "which listings" and "in what
// order" answer to the same definition of relevance. Sorts in place and
// returns the same array, so it can be used either way at the call site.
function sortByRelevance<T extends { confidence: number; priceDiff: number | null }>(listings: T[]): T[] {
  return listings.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.priceDiff == null || b.priceDiff == null) return 0;
    return a.priceDiff - b.priceDiff;
  });
}

// Round-robins across platforms instead of a flat top-N slice, so a single
// platform's denser candidate pool (e.g. ShoppersPK/Naheed vs Daraz in
// toys-and-baby, ~11x the row count) can't crowd out every other platform's
// closest matches. `sorted` must already be confidence-desc (then price-diff
// asc) - grouping by platform preserves that order per platform, so taking
// the front of each platform's queue in turn is always "best remaining for
// that platform." Once a platform's queue empties it's skipped, so the
// remaining slots naturally fill from whichever platforms still have
// candidates - no separate fallback pass needed.
function selectDiverseTopN<T extends { matchedPlatformName: string | null }>(sorted: T[], limit: number): T[] {
  const byPlatform = new Map<string, T[]>();
  for (const item of sorted) {
    const key = item.matchedPlatformName ?? '__unknown__';
    const queue = byPlatform.get(key);
    if (queue) queue.push(item);
    else byPlatform.set(key, [item]);
  }

  const result: T[] = [];
  const platforms = [...byPlatform.keys()];
  let tookAny = true;
  while (result.length < limit && tookAny) {
    tookAny = false;
    for (const platform of platforms) {
      if (result.length >= limit) break;
      const queue = byPlatform.get(platform)!;
      const next = queue.shift();
      if (next) {
        result.push(next);
        tookAny = true;
      }
    }
  }
  return result;
}

// Best-effort: upserts the seller's currently-viewed top matches so a
// price/decommission history can accumulate. On conflict (seller_product_id,
// market_product_id), confidence and last_confirmed_at are refreshed but
// first_matched_at is left untouched (omitted from the payload) - it should
// only ever be set once, at the row's original insert.
async function persistCompetitorMatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sellerId: string,
  sellerProductId: string,
  matches: Array<{ marketProductId: string; confidence: number }>,
): Promise<void> {
  if (matches.length === 0) return;

  const rows = matches.map((m) => ({
    seller_id: sellerId,
    seller_product_id: sellerProductId,
    market_product_id: m.marketProductId,
    confidence: m.confidence,
    last_confirmed_at: new Date().toISOString(),
  }));

  try {
    // A write failure here must never break the live listings response -
    // this only feeds a history feature, it isn't the feature itself.
    await supabase.from('seller_product_competitor_matches').upsert(rows, { onConflict: 'seller_product_id,market_product_id' });
  } catch {
    // ignored, see comment above
  }
}
