'server-only';

import { createClient } from '@/lib/supabase/server';
import { convertCurrency, getLatestFxRates, type FxRates } from '@/lib/market-intel/fx';
import { getMarketScope, getMarketScopeForAllDomains, type MarketScope } from '@/lib/market-intel/market/market-definition';
import { findTopSimilarCandidatesBatch } from '@/lib/market-intel/market/candidate-search';
import { tokenize, jaccard, MIN_CONFIDENCE, MIN_COMPETITOR_CONFIDENCE } from '@/lib/market-intel/core/similarity';

// ROADMAP.md C1 - Block 4 of the framework, the competitor entity.
//
// Every other market surface in this app answers "what is the market doing".
// This one answers "who is doing it", which is the question a seller actually
// acts on: you do not reprice against a median, you reprice against the two
// sellers who keep undercutting you.
//
// Two honest limits, stated here because they must also be stated in the UI:
//
//   1. A competitor here is either a named marketplace seller (Daraz) or a
//      whole single-retailer platform (Priceoye, Telemart, Shophive,
//      iShopping, Goto, SapphireOnline, ...) treated as one competitor -
//      migration 056, via market_single_retailer_platforms(). On those
//      sites the platform IS the seller, so its own name identifies it
//      completely; there was never anything to enrich, only a filter that
//      excluded them. OLX posters are still excluded - individuals, not
//      competitors you can benchmark.
//   2. Overlap and win/loss are computed by title similarity (the same
//      token-Jaccard matcher as product-matching.ts), not by a resolved
//      catalog. It is directional and is labelled as such.

const REPRICING_LOOKBACK_DAYS = 30;
const MAX_COMPETITORS = 25;

/**
 * Which of the given platforms are single-retailer (migration 056) - the
 * platform IS the seller, so every one of its listings is the same
 * competitor even though seller_external_id is null on all of them.
 *
 * Exported so any caller that groups scraped listings by seller (not just
 * this module's own RPC-backed scorecards) can fold a single-retailer
 * platform's anonymous rows into one identity instead of treating them as
 * ungrouped or, worse, one competitor per row. Kept as one function so that
 * definition can't drift from market_single_retailer_platforms() itself.
 */
export async function getSingleRetailerPlatformIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  platformIds: string[],
): Promise<Set<string>> {
  if (platformIds.length === 0) return new Set();

  const { data, error } = await supabase.rpc('market_single_retailer_platforms');
  if (error || !data) return new Set();

  const inScope = new Set(platformIds);
  return new Set(
    (data as { platform_id: string }[]).map((row) => row.platform_id).filter((id) => inScope.has(id)),
  );
}

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
  total_identified_sku_count: number | string | null;
};

const num = (value: number | string | null | undefined): number | null =>
  value == null ? null : Number(value);
const int = (value: number | string | null | undefined): number => Number(value ?? 0);

export type CompetitorLandscape = {
  scorecards: CompetitorScorecard[];
  /** Total in-scope SKUs carrying a seller identity — the share denominator. */
  identifiedSkuCount: number;
  /**
   * In-scope SKUs with no seller identity AND on a platform that does
   * attribute other listings to real sellers - a genuine attribution gap.
   * A platform with no seller identity on ANY of its listings (migration
   * 056) is no longer counted here at all: it gets its own competitor row,
   * keyed on the platform itself, instead of being anonymous.
   */
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
  return getCompetitorLandscapeFromScope(scope, targetCurrency, fxRatesOverride);
}

/**
 * Same landscape, aggregated across every domain the seller tracks (see
 * getMarketScopeForAllDomains's own comment for why the scope union is a
 * valid input to the same RPCs a single-category scope uses) - the
 * Competitors page's "All My Products" tab.
 */
export async function getCompetitorLandscapeAllDomains(
  sellerId: string,
  targetCurrency: string,
  fxRatesOverride?: FxRates,
): Promise<CompetitorLandscape> {
  const scope = await getMarketScopeForAllDomains(sellerId);
  return getCompetitorLandscapeFromScope(scope, targetCurrency, fxRatesOverride);
}

async function getCompetitorLandscapeFromScope(
  scope: MarketScope,
  targetCurrency: string,
  fxRatesOverride?: FxRates,
): Promise<CompetitorLandscape> {
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
    // Band/brand filters mirror getScopeMedianPrice below, exactly - both
    // read from the same scope.definition, so the competitor numbers and the
    // market median they're indexed against are always computed over the
    // same population. (Migration 040: this call used to omit these
    // entirely, so a seller who narrowed their market with a price band got
    // a price_index dividing a filtered market median by an unfiltered
    // competitor median.)
    supabase.rpc('market_competitor_scorecards', {
      p_category_slugs: scope.categorySlugs,
      p_platform_ids: scope.activePlatformIds,
      p_target_currency: targetCurrency,
      p_rates: fxRates,
      p_lookback_days: REPRICING_LOOKBACK_DAYS,
      p_limit: MAX_COMPETITORS,
      p_band_currency: scope.definition.priceCurrency,
      p_price_min: scope.definition.priceMin,
      p_price_max: scope.definition.priceMax,
      p_brands: scope.definition.brands,
      p_cities: scope.definition.cities,
    }),
    // Counted, not inferred from the scorecards: the difference between these
    // two numbers is the coverage caveat the page has to show. A seller
    // looking at four named competitors deserves to know that some in-scope
    // listings have no seller behind them at all.
    //
    // An RPC rather than a plain PostgREST count (migration 056): this now
    // has to exclude single-retailer platforms - their listings are
    // identified via the platform-as-competitor row, not anonymous - and
    // that classification lives in market_single_retailer_platforms(). A
    // second, hand-written copy of that same logic here could silently
    // drift from what market_competitor_scorecards() actually does.
    supabase.rpc('market_anonymous_sku_count', {
      p_category_slugs: scope.categorySlugs,
      p_platform_ids: scope.activePlatformIds,
    }),
  ]);

  if (scorecardsRes.error || !scorecardsRes.data) return empty;

  const rows = scorecardsRes.data as ScorecardRow[];
  // total_identified_sku_count (migration 040) is the true count over every
  // identified competitor in scope, computed in SQL before the p_limit
  // cutoff - summing only the returned rows' sku_count would undercount as
  // soon as more than MAX_COMPETITORS sellers are identified (Daraz alone
  // has 58 in some categories per mind.md), which also silently inflated
  // every assortmentShare below.
  const identifiedSkuCount = int(rows[0]?.total_identified_sku_count);

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
    anonymousSkuCount: Number(anonymousRes.data ?? 0),
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
 * Bounded on purpose (60 seller SKUs, each scored against its own
 * findTopSimilarCandidates() result - see candidate-search.ts), like
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
  return getCompetitorOverlapFromScope(sellerId, scope, targetCurrency);
}

/** Same head-to-head overlap, aggregated across every tracked domain. */
export async function getCompetitorOverlapAllDomains(
  sellerId: string,
  targetCurrency: string,
): Promise<Map<string, CompetitorOverlap>> {
  const scope = await getMarketScopeForAllDomains(sellerId);
  return getCompetitorOverlapFromScope(sellerId, scope, targetCurrency);
}

async function getCompetitorOverlapFromScope(
  sellerId: string,
  scope: MarketScope,
  targetCurrency: string,
): Promise<Map<string, CompetitorOverlap>> {
  const result = new Map<string, CompetitorOverlap>();
  if (scope.categorySlugs.length === 0) return result;

  const supabase = await createClient();
  const [sellerRes, fxRates] = await Promise.all([
    supabase
      .from('seller_products')
      .select('id, title, sell_price, currency')
      .eq('seller_id', sellerId)
      .eq('is_active', true)
      .not('sell_price', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(MAX_SELLER_PRODUCTS),
    getLatestFxRates(),
  ]);

  if (sellerRes.error || !sellerRes.data) return result;
  if (sellerRes.data.length === 0) return result;

  // One RPC for every seller product at once (migration 047), index-aligned
  // with sellerRes.data. Only rows with a named seller (seller_external_id)
  // count here, unlike the other *FromScope functions - this specifically
  // answers "who am I up against by name," so an anonymous single-retailer
  // listing (the platform itself is the seller) can't count as a head-to-head
  // competitor. That filter stays app-side: the batch RPC returns exactly what
  // the single-title one does so both callers share a candidate set, and only
  // this caller wants it narrowed.
  const perProductCandidates = (
    await findTopSimilarCandidatesBatch(
      supabase,
      scope.categorySlugs,
      scope.activePlatformIds,
      sellerRes.data.map((product) => product.title),
    )
  ).map((candidates) => candidates.filter((c) => c.sellerExternalId != null && c.price != null));

  const sellerProducts = sellerRes.data.map((row) => ({
    tokens: tokenize(row.title),
    price: convertCurrency(Number(row.sell_price), row.currency ?? 'PKR', targetCurrency, fxRates),
  }));

  // Per competitor, only the *best* match for each seller SKU counts. Without
  // that, a competitor listing the same phone in six variants would register
  // as six overlaps and swamp the win/loss ratio.
  const gaps = new Map<string, number[]>();

  sellerProducts.forEach((sellerProduct, index) => {
    const candidates = perProductCandidates[index].map((c) => ({
      externalId: c.sellerExternalId as string,
      tokens: tokenize(c.title),
      price: convertCurrency(c.price as number, c.currency ?? 'PKR', targetCurrency, fxRates),
    }));
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
  });

  for (const [externalId, list] of gaps) {
    const entry = result.get(externalId);
    if (!entry || list.length === 0) continue;
    const sorted = [...list].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    entry.priceGap = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  return result;
}

// ---------------------------------------------------------------------------
// The seller's own accumulated match history (not recomputed - read from
// seller_product_competitor_matches, populated by product-matching.ts's
// persistCompetitorMatches() whenever a seller opens a product's Competitors
// drawer). Unlike getCompetitorOverlap above, this is NOT a fresh
// title-similarity pass: it is literally how many of the seller's own
// products have a saved match against this competitor, as of whenever they
// last looked. It only grows as the seller opens drawers, so a low/zero
// count here means "not reviewed yet," not "no real match exists" - that
// distinction has to survive into the UI copy, not just live here.
// ---------------------------------------------------------------------------

const MAX_MATCH_ROWS = 2000;

export type CompetitorMatchStats = {
  externalId: string;
  /** Distinct seller_products with a persisted match against this competitor. */
  matchedProductCount: number;
};

type MatchRow = {
  seller_product_id: string;
  market_products: {
    platform_id: string;
    seller_external_id: string | null;
    category_slug: string;
    is_active: boolean;
  } | null;
};

export type MatchedListing = {
  sellerProductTitle: string;
  matchedTitle: string;
  matchedPlatformName: string | null;
  matchedPrice: number | null;
  matchedCurrency: string | null;
  matchedUrl: string;
  confidence: number;
};

type MatchedListingRow = {
  confidence: number | string;
  seller_products: { title: string } | { title: string }[] | null;
  market_products: {
    title: string;
    price: number | string | null;
    currency: string | null;
    url: string;
    market_platforms: { name: string } | { name: string }[] | null;
  } | null;
};

/**
 * One row per (seller product x matched competitor listing) pair, for CSV
 * export - not used by any on-screen panel, so unlike the other functions
 * here this reads straight from seller_product_competitor_matches without
 * going through a *FromScope split; still scoped by category/platform so an
 * export only ever contains listings the seller's own market actually
 * includes.
 *
 * Filtered by confidence >= MIN_COMPETITOR_CONFIDENCE (2026-08-29 fix): a
 * persisted row's confidence is a snapshot from whenever a seller last
 * opened that product's Competitors drawer, not live. Scraped
 * market_products rows get overwritten in place on every re-scrape (same
 * row/id, title can change if the retailer edits their listing), so an old
 * high-confidence match can go stale and drift toward nonsense once the
 * matched title changes - caught live in an exported CSV showing "Avalanche
 * Fruity" matched against Gillette razors and hair serum at confidence 0.
 * This can't fix an already-stale row's stored number (that only refreshes
 * when the seller reopens that specific product's drawer), but it stops an
 * export from surfacing a match that's clearly no longer valid, matching
 * the same gate every live-computed match already has to pass.
 */
export async function getMatchedListingsForExport(sellerId: string, scope: MarketScope): Promise<MatchedListing[]> {
  if (scope.categorySlugs.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('seller_product_competitor_matches')
    .select(
      'confidence, seller_products(title), market_products!inner(title, price, currency, url, is_active, category_slug, platform_id, market_platforms(name))',
    )
    .eq('seller_id', sellerId)
    .gte('confidence', MIN_COMPETITOR_CONFIDENCE)
    .eq('market_products.is_active', true)
    .in('market_products.category_slug', scope.categorySlugs)
    .in('market_products.platform_id', scope.activePlatformIds)
    .limit(MAX_MATCH_ROWS);

  if (error || !data) return [];

  return (data as unknown as MatchedListingRow[])
    .map((row) => {
      const sellerProduct = Array.isArray(row.seller_products) ? row.seller_products[0] : row.seller_products;
      const marketProduct = row.market_products;
      if (!sellerProduct || !marketProduct) return null;
      const platform = Array.isArray(marketProduct.market_platforms)
        ? marketProduct.market_platforms[0]
        : marketProduct.market_platforms;

      return {
        sellerProductTitle: sellerProduct.title,
        matchedTitle: marketProduct.title,
        matchedPlatformName: platform?.name ?? null,
        matchedPrice: marketProduct.price != null ? Number(marketProduct.price) : null,
        matchedCurrency: marketProduct.currency,
        matchedUrl: marketProduct.url,
        confidence: Number(row.confidence),
      };
    })
    .filter((row): row is MatchedListing => row !== null);
}

export async function getCompetitorMatchCounts(
  sellerId: string,
  sellerCategorySlug: string,
): Promise<Map<string, CompetitorMatchStats>> {
  const scope = await getMarketScope(sellerCategorySlug, sellerId);
  return getCompetitorMatchCountsFromScope(sellerId, scope);
}

/** Same persisted-match counts, aggregated across every tracked domain. */
export async function getCompetitorMatchCountsAllDomains(
  sellerId: string,
): Promise<Map<string, CompetitorMatchStats>> {
  const scope = await getMarketScopeForAllDomains(sellerId);
  return getCompetitorMatchCountsFromScope(sellerId, scope);
}

async function getCompetitorMatchCountsFromScope(
  sellerId: string,
  scope: MarketScope,
): Promise<Map<string, CompetitorMatchStats>> {
  const result = new Map<string, CompetitorMatchStats>();
  if (scope.categorySlugs.length === 0) return result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('seller_product_competitor_matches')
    .select(
      'seller_product_id, market_products!inner(platform_id, seller_external_id, category_slug, is_active)',
    )
    .eq('seller_id', sellerId)
    .eq('market_products.is_active', true)
    .in('market_products.category_slug', scope.categorySlugs)
    .in('market_products.platform_id', scope.activePlatformIds)
    .limit(MAX_MATCH_ROWS);

  if (error || !data) return result;

  const productsByCompetitor = new Map<string, Set<string>>();
  for (const row of data as unknown as MatchRow[]) {
    const externalId = row.market_products?.seller_external_id;
    if (!externalId) continue;
    const set = productsByCompetitor.get(externalId) ?? new Set<string>();
    set.add(row.seller_product_id);
    productsByCompetitor.set(externalId, set);
  }

  for (const [externalId, set] of productsByCompetitor) {
    result.set(externalId, { externalId, matchedProductCount: set.size });
  }

  return result;
}
