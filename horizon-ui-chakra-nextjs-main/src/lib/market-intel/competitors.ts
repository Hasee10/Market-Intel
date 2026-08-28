'server-only';

import { createClient } from '@/lib/supabase/server';
import { convertCurrency, getLatestFxRates, type FxRates } from '@/lib/market-intel/fx';
import { getMarketScope, type MarketScope } from '@/lib/market-intel/market-definition';
import { tokenize, jaccard, MIN_CONFIDENCE } from '@/lib/market-intel/similarity';

// ROADMAP.md C1 - Block 4 of the framework, the competitor entity.
//
// Every other market surface in this app answers "what is the market doing".
// This one answers "who is doing it", which is the question a seller actually
// acts on: you do not reprice against a median, you reprice against the two
// sellers who keep undercutting you.
//
// Two honest limits, stated here because they must also be stated in the UI:
//
//   1. Only true marketplaces can populate this. On Priceoye, Telemart,
//      Shophive, iShopping, Goto and SapphireOnline the platform *is* the
//      seller, so there is no merchant to name; OLX posters are individuals,
//      not competitors you can benchmark. Today that means Daraz, and D2 will
//      not change it for the single-retailer sources - nothing to enrich.
//   2. Overlap and win/loss are computed by title similarity (the same
//      token-Jaccard matcher as product-matching.ts), not by a resolved
//      catalog. It is directional and is labelled as such.

const REPRICING_LOOKBACK_DAYS = 30;
const MAX_COMPETITORS = 25;

export type CompetitorScorecard = {
  competitorId: string | null;
  externalId: string;
  name: string;
  platformName: string;
  skuCount: number;
  brandCount: number;
  categoryCount: number;
  /** Share of every in-scope SKU that belongs to this competitor, 0–1. */
  assortmentShare: number;
  minPrice: number | null;
  medianPrice: number | null;
  maxPrice: number | null;
  /** Null when no listing of theirs reports stock at all. */
  inStockRate: number | null;
  soldUnits: number;
  avgRating: number | null;
  ratedSkuCount: number;
  /** Share of price observations that moved, 0–1. Null when unobserved. */
  priceChangeRate: number | null;
  observedSkuCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  /** How they price against the whole market median, e.g. -0.08 = 8% below. */
  priceIndex: number | null;
};

type ScorecardRow = {
  competitor_id: string | null;
  external_id: string;
  name: string | null;
  platform_name: string | null;
  sku_count: number | string | null;
  brand_count: number | string | null;
  category_count: number | string | null;
  min_price: number | string | null;
  median_price: number | string | null;
  max_price: number | string | null;
  in_stock_rate: number | string | null;
  sold_units: number | string | null;
  avg_rating: number | string | null;
  rated_sku_count: number | string | null;
  price_change_rate: number | string | null;
  observed_sku_count: number | string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

const num = (value: number | string | null | undefined): number | null =>
  value == null ? null : Number(value);
const int = (value: number | string | null | undefined): number => Number(value ?? 0);

export type CompetitorLandscape = {
  scorecards: CompetitorScorecard[];
  /** Total in-scope SKUs carrying a seller identity — the share denominator. */
  identifiedSkuCount: number;
  /** In-scope SKUs with no seller identity at all (single-retailer sources). */
  anonymousSkuCount: number;
  marketMedianPrice: number | null;
  platformsWithIdentity: string[];
  lookbackDays: number;
  hasTaxonomy: boolean;
};

/**
 * The competitor landscape inside the seller's own market definition
 * (ROADMAP.md A3), not inside a category. Narrowing the market narrows who
 * counts as a competitor, which is the point of having defined it.
 */
export async function getCompetitorLandscape(
  sellerCategorySlug: string,
  targetCurrency: string,
  sellerId?: string,
  // Report generation fetches one fx snapshot for the whole run and threads
  // it through every collector so every section agrees on the same rates
  // (see docs/reports-v2-architecture.md's currency-consistency note) - other
  // callers (the Competitors dashboard page) omit this and get a fresh fetch,
  // which is fine for a single-section page render.
  fxRatesOverride?: FxRates,
): Promise<CompetitorLandscape> {
  const scope = await getMarketScope(sellerCategorySlug, sellerId);
  const empty: CompetitorLandscape = {
    scorecards: [],
    identifiedSkuCount: 0,
    anonymousSkuCount: 0,
    marketMedianPrice: null,
    platformsWithIdentity: [],
    lookbackDays: REPRICING_LOOKBACK_DAYS,
    hasTaxonomy: scope.hasTaxonomy,
  };
  if (scope.categorySlugs.length === 0) return empty;

  const supabase = await createClient();
  const fxRates = fxRatesOverride ?? (await getLatestFxRates());

  const [scorecardsRes, anonymousRes] = await Promise.all([
    supabase.rpc('market_competitor_scorecards', {
      p_category_slugs: scope.categorySlugs,
      p_platform_ids: scope.activePlatformIds,
      p_target_currency: targetCurrency,
      p_rates: fxRates,
      p_lookback_days: REPRICING_LOOKBACK_DAYS,
      p_limit: MAX_COMPETITORS,
    }),
    // Counted, not inferred from the scorecards: the difference between these
    // two numbers is the coverage caveat the page has to show. A seller
    // looking at four named competitors deserves to know that 5,000 in-scope
    // listings have no seller behind them at all.
    supabase
      .from('market_products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('seller_external_id', null)
      .in('category_slug', scope.categorySlugs)
      .in('platform_id', scope.activePlatformIds),
  ]);

  if (scorecardsRes.error || !scorecardsRes.data) return empty;

  const rows = scorecardsRes.data as ScorecardRow[];
  const identifiedSkuCount = rows.reduce((sum, row) => sum + int(row.sku_count), 0);

  // The market median every competitor is indexed against. Taken from the same
  // scope, so "8% below market" means below *this seller's* market, not below
  // a category-wide number they never chose.
  const marketMedianPrice = await getScopeMedianPrice(scope, targetCurrency, fxRates);

  const scorecards: CompetitorScorecard[] = rows.map((row) => {
    const medianPrice = num(row.median_price);
    return {
      competitorId: row.competitor_id,
      externalId: row.external_id,
      name: row.name ?? row.external_id,
      platformName: row.platform_name ?? 'Unknown',
      skuCount: int(row.sku_count),
      brandCount: int(row.brand_count),
      categoryCount: int(row.category_count),
      assortmentShare: identifiedSkuCount > 0 ? int(row.sku_count) / identifiedSkuCount : 0,
      minPrice: num(row.min_price),
      medianPrice,
      maxPrice: num(row.max_price),
      inStockRate: num(row.in_stock_rate),
      soldUnits: int(row.sold_units),
      avgRating: num(row.avg_rating),
      ratedSkuCount: int(row.rated_sku_count),
      priceChangeRate: num(row.price_change_rate),
      observedSkuCount: int(row.observed_sku_count),
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      priceIndex:
        marketMedianPrice && medianPrice != null && marketMedianPrice > 0
          ? medianPrice / marketMedianPrice - 1
          : null,
    };
  });

  return {
    scorecards,
    identifiedSkuCount,
    anonymousSkuCount: anonymousRes.count ?? 0,
    marketMedianPrice,
    platformsWithIdentity: Array.from(new Set(scorecards.map((s) => s.platformName))).sort(),
    lookbackDays: REPRICING_LOOKBACK_DAYS,
    hasTaxonomy: scope.hasTaxonomy,
  };
}

async function getScopeMedianPrice(
  scope: MarketScope,
  targetCurrency: string,
  fxRates: Record<string, number>,
): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('market_scope_price_stats', {
      p_category_slugs: scope.categorySlugs,
      p_platform_ids: scope.activePlatformIds,
      p_target_currency: targetCurrency,
      p_rates: fxRates,
      p_band_currency: scope.definition.priceCurrency,
      p_price_min: scope.definition.priceMin,
      p_price_max: scope.definition.priceMax,
      p_brands: scope.definition.brands,
      p_cities: scope.definition.cities,
    })
    .maybeSingle<{ median: number | string | null }>();

  if (error || !data) return null;
  return num(data.median);
}

// ---------------------------------------------------------------------------
// Overlap and price win/loss against the seller's own catalog
// ---------------------------------------------------------------------------

const MAX_SELLER_PRODUCTS = 60;
const MAX_MARKET_CANDIDATES = 1500;

export type CompetitorOverlap = {
  externalId: string;
  /** Seller SKUs with a plausible match in this competitor's assortment. */
  overlapCount: number;
  /** Of those, how many the seller prices below / above the competitor. */
  winCount: number;
  lossCount: number;
  /** Median % the seller is above (+) or below (−) them on overlapping SKUs. */
  priceGap: number | null;
};

/**
 * Head-to-head, per competitor: how much of the seller's catalog they also
 * carry, and who is cheaper on it.
 *
 * Bounded on purpose (60 seller SKUs x 1,500 candidates), like
 * product-matching.ts, because this is recomputed per request with no
 * persisted match table. It is a directional read on a real question, not a
 * catalog reconciliation - a seller with 5,000 SKUs gets their 60 most
 * recently touched, and the UI says so.
 */
export async function getCompetitorOverlap(
  sellerId: string,
  sellerCategorySlug: string,
  targetCurrency: string,
): Promise<Map<string, CompetitorOverlap>> {
  const scope = await getMarketScope(sellerCategorySlug, sellerId);
  const result = new Map<string, CompetitorOverlap>();
  if (scope.categorySlugs.length === 0) return result;

  const supabase = await createClient();
  const [sellerRes, marketRes, fxRates] = await Promise.all([
    supabase
      .from('seller_products')
      .select('id, title, sell_price, currency')
      .eq('seller_id', sellerId)
      .eq('is_active', true)
      .not('sell_price', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(MAX_SELLER_PRODUCTS),
    supabase
      .from('market_products')
      .select('title, price, currency, seller_external_id')
      .eq('is_active', true)
      .not('seller_external_id', 'is', null)
      .not('price', 'is', null)
      .in('category_slug', scope.categorySlugs)
      .in('platform_id', scope.activePlatformIds)
      .limit(MAX_MARKET_CANDIDATES),
    getLatestFxRates(),
  ]);

  if (sellerRes.error || !sellerRes.data || marketRes.error || !marketRes.data) return result;

  const sellerProducts = sellerRes.data.map((row) => ({
    tokens: tokenize(row.title),
    price: convertCurrency(Number(row.sell_price), row.currency ?? 'PKR', targetCurrency, fxRates),
  }));
  if (sellerProducts.length === 0) return result;

  const candidates = marketRes.data.map((row) => ({
    externalId: row.seller_external_id as string,
    tokens: tokenize(row.title),
    price: convertCurrency(Number(row.price), row.currency ?? 'PKR', targetCurrency, fxRates),
  }));

  // Per competitor, only the *best* match for each seller SKU counts. Without
  // that, a competitor listing the same phone in six variants would register
  // as six overlaps and swamp the win/loss ratio.
  const gaps = new Map<string, number[]>();

  for (const sellerProduct of sellerProducts) {
    const bestPerCompetitor = new Map<string, { score: number; price: number }>();

    for (const candidate of candidates) {
      const score = jaccard(sellerProduct.tokens, candidate.tokens);
      if (score < MIN_CONFIDENCE) continue;
      const current = bestPerCompetitor.get(candidate.externalId);
      if (!current || score > current.score) {
        bestPerCompetitor.set(candidate.externalId, { score, price: candidate.price });
      }
    }

    for (const [externalId, match] of bestPerCompetitor) {
      const entry =
        result.get(externalId) ??
        ({ externalId, overlapCount: 0, winCount: 0, lossCount: 0, priceGap: null } as CompetitorOverlap);
      entry.overlapCount += 1;
      if (sellerProduct.price < match.price) entry.winCount += 1;
      else if (sellerProduct.price > match.price) entry.lossCount += 1;
      result.set(externalId, entry);

      if (match.price > 0) {
        const list = gaps.get(externalId) ?? [];
        list.push(sellerProduct.price / match.price - 1);
        gaps.set(externalId, list);
      }
    }
  }

  for (const [externalId, list] of gaps) {
    const entry = result.get(externalId);
    if (!entry || list.length === 0) continue;
    const sorted = [...list].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    entry.priceGap = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  return result;
}
