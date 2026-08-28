'server-only';

import { createClient } from '@/lib/supabase/server';
import { getMarketScope } from '@/lib/market-intel/market-definition';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';
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
const MAX_MARKET_CANDIDATES = 300;

// Bounded on purpose: this recomputes similarity in-process on every call
// (no persisted match table yet), so it's capped to the seller's most
// recently updated active products against a capped candidate pool from
// market_products, not run over the whole catalog.
export async function findTopProductMatches(
  sellerId: string,
  categorySlug: string,
  reportingCurrency = 'PKR',
): Promise<ProductMatch[]> {
  const scope = await getMarketScope(categorySlug, sellerId);
  if (scope.categorySlugs.length === 0) return [];

  const supabase = await createClient();

  const [sellerProductsRes, marketProductsRes, fxRates] = await Promise.all([
    supabase
      .from('seller_products')
      .select('id, title, sell_price, currency')
      .eq('seller_id', sellerId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(MAX_SELLER_PRODUCTS),
    supabase
      .from('market_products')
      .select('title, price, currency, url, category_slug, market_platforms(name)')
      .eq('is_active', true)
      .in('category_slug', scope.categorySlugs)
      .in('platform_id', scope.activePlatformIds)
      .limit(MAX_MARKET_CANDIDATES),
    getLatestFxRates(),
  ]);

  if (sellerProductsRes.error || !sellerProductsRes.data) return [];
  if (marketProductsRes.error || !marketProductsRes.data) return [];

  const candidates = marketProductsRes.data
    .map((row) => {
      const platform = Array.isArray(row.market_platforms) ? row.market_platforms[0] : row.market_platforms;
      return {
        title: row.title,
        price:
          row.price != null ? convertCurrency(Number(row.price), row.currency ?? 'PKR', reportingCurrency, fxRates) : null,
        url: row.url,
        platformName: platform?.name ?? null,
        tokens: tokenize(row.title),
      };
    });

  if (candidates.length === 0) return [];

  const matches: ProductMatch[] = [];

  for (const sellerProduct of sellerProductsRes.data) {
    const sellerTokens = tokenize(sellerProduct.title);
    let best: (typeof candidates)[number] | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = jaccard(sellerTokens, candidate.tokens);
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
        matchedPrice: best.price,
        matchedUrl: best.url,
        confidence: Number(bestScore.toFixed(2)),
      });
    }
  }

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
};

// Raised from 5 (2026-08-28): at 5, categories with a much denser in-bracket
// candidate pool on one platform (e.g. ShoppersPK/Naheed in toys-and-baby,
// ~1319 active rows vs Daraz's ~120) crowded out every other platform's
// listings entirely. 15 gives enough headroom for a smaller platform's
// closest matches to still surface without returning the whole candidate
// pool.
const MAX_COMPETITOR_MATCHES = 15;

// Separate, much larger cap than MAX_MARKET_CANDIDATES (300, shared with
// findTopProductMatches - which genuinely needs a small cap since it runs
// per-candidate comparisons across up to 20 seller products in one call).
// This function only ever handles one seller product per call, so the cost
// of scoring more candidates in JS is trivial - but the query below has no
// ORDER BY, so a small cap on a category with thousands of active rows
// across several segments (e.g. "Mobiles & Electronics" spanning Audio,
// Laptops & Computing, Phones, Tablets) could sample an arbitrary 300 rows
// that happen to miss the seller's actual segment entirely. Found live:
// a product titled "Laptops" returned zero matches in a category with
// 3,556 active listings, because none of an unordered 300-row sample
// happened to be laptops. Raising this doesn't fix the lack of an ORDER BY
// (still arbitrary which rows get dropped if a category exceeds this too),
// but 3000 covers real categories seen so far with room to spare.
const MAX_COMPETITOR_CANDIDATES = 3000;

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

  const [sellerProductRes, marketProductsRes, fxRates] = await Promise.all([
    supabase
      .from('seller_products')
      .select('id, title, sell_price, currency')
      .eq('id', sellerProductId)
      .eq('seller_id', sellerId)
      .maybeSingle(),
    supabase
      .from('market_products')
      .select('id, title, price, currency, url, rating, rating_count, sold_count, category_slug, market_platforms(name)')
      .eq('is_active', true)
      .in('category_slug', scope.categorySlugs)
      .in('platform_id', scope.activePlatformIds)
      .limit(MAX_COMPETITOR_CANDIDATES),
    getLatestFxRates(),
  ]);

  if (sellerProductRes.error || !sellerProductRes.data) return [];
  if (marketProductsRes.error || !marketProductsRes.data) return [];

  const sellerTokens = tokenize(sellerProductRes.data.title);
  const sellerPrice =
    sellerProductRes.data.sell_price != null
      ? convertCurrency(Number(sellerProductRes.data.sell_price), sellerProductRes.data.currency ?? 'PKR', reportingCurrency, fxRates)
      : null;

  const scored = marketProductsRes.data
    .map((row) => {
      const platform = Array.isArray(row.market_platforms) ? row.market_platforms[0] : row.market_platforms;
      const matchedPrice =
        row.price != null ? convertCurrency(Number(row.price), row.currency ?? 'PKR', reportingCurrency, fxRates) : null;
      return {
        marketProductId: row.id,
        matchedTitle: row.title,
        matchedPlatformName: platform?.name ?? null,
        matchedPrice,
        matchedUrl: row.url,
        rating: row.rating != null ? Number(row.rating) : null,
        ratingCount: row.rating_count != null ? Number(row.rating_count) : null,
        soldCount: row.sold_count != null ? Number(row.sold_count) : null,
        confidence: Number(jaccard(sellerTokens, tokenize(row.title)).toFixed(2)),
        priceDiff: sellerPrice != null && matchedPrice != null ? Math.abs(matchedPrice - sellerPrice) : null,
      };
    })
    // Title similarity is the only hard filter now - price is never used to
    // exclude a candidate, only to break ties below among equally-confident
    // matches (see the header comment above for why this replaced the old
    // price-bracket filter).
    .filter((listing) => listing.confidence >= MIN_COMPETITOR_CONFIDENCE)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (a.priceDiff == null || b.priceDiff == null) return 0;
      return a.priceDiff - b.priceDiff;
    });

  const top = selectDiverseTopN(scored, limit);

  await persistCompetitorMatches(supabase, sellerId, sellerProductId, top);

  return top.map(({ priceDiff, marketProductId, ...listing }) => listing);
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
