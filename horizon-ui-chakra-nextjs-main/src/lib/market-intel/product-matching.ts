'server-only';

import { createClient } from '@/lib/supabase/server';
import { getMarketScope } from '@/lib/market-intel/market-definition';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';
import { tokenize, jaccard, MIN_CONFIDENCE } from '@/lib/market-intel/similarity';

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
// Matching model (confirmed with product owner 2026-08-28, using a GPU
// example): a $300 and a $1500 GPU are not competitors even if their titles
// overlap, and two different GPU models at a similar price ARE competitors
// even if their titles don't overlap at all. So price bracket (same
// category, seller's price +/-PRICE_BRACKET_PCT) is the hard filter that
// decides inclusion; title similarity is only a ranking signal within that
// bracket, not a filter - it surfaces near-identical listings first without
// excluding a genuinely comparable but differently-named product.
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

const MAX_COMPETITOR_MATCHES = 5;
const PRICE_BRACKET_PCT = 0.15;

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
      .limit(MAX_MARKET_CANDIDATES),
    getLatestFxRates(),
  ]);

  if (sellerProductRes.error || !sellerProductRes.data) return [];
  if (marketProductsRes.error || !marketProductsRes.data) return [];

  const sellerTokens = tokenize(sellerProductRes.data.title);
  const sellerPrice =
    sellerProductRes.data.sell_price != null
      ? convertCurrency(Number(sellerProductRes.data.sell_price), sellerProductRes.data.currency ?? 'PKR', reportingCurrency, fxRates)
      : null;
  // No listed sell_price yet (still being set up) - fall back to
  // category-only, title-ranked results rather than returning nothing.
  const bracketMin = sellerPrice != null ? sellerPrice * (1 - PRICE_BRACKET_PCT) : null;
  const bracketMax = sellerPrice != null ? sellerPrice * (1 + PRICE_BRACKET_PCT) : null;

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
    .filter((listing) => {
      if (bracketMin == null || bracketMax == null) return true;
      // A candidate with no price can't be judged against the bracket -
      // exclude it rather than guessing it belongs.
      if (listing.matchedPrice == null) return false;
      return listing.matchedPrice >= bracketMin && listing.matchedPrice <= bracketMax;
    })
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (a.priceDiff == null || b.priceDiff == null) return 0;
      return a.priceDiff - b.priceDiff;
    });

  const top = scored.slice(0, limit);

  await persistCompetitorMatches(supabase, sellerId, sellerProductId, top);

  return top.map(({ priceDiff, marketProductId, ...listing }) => listing);
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
