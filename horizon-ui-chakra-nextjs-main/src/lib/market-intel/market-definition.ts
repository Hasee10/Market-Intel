'server-only';

import { createClient } from '@/lib/supabase/server';
import { getCurrentSeller, listSellerDomainSlugs } from '@/lib/market-intel/seller';
import { getLatestFxRates } from '@/lib/market-intel/fx';

// ROADMAP.md A3. This replaces category-keywords.ts, which mapped a seller's
// category to scraped rows with one regex per category and matched it against
// the raw `category_slug` string. Three things were wrong with that:
//
//   1. It was invisible. The seller could not see, question or change the
//      definition of "their market" - the thing every number on every page is
//      computed against. That is Block 1 of the framework, absent.
//   2. It was too coarse to be defensible. One pattern for
//      `mobiles-and-electronics` swept in both `priceoye/power-banks`
//      (median ~3.6k) and `shophive/laptops-computers/laptops` (median ~364k),
//      then handed a phone-case seller the median of that blend.
//   3. It was greedy. A regex silently absorbs slugs nobody reviewed, so a
//      scraper emitting a new category never surfaced as a decision.
//
// The taxonomy now lives in `market_category_map` (migration 020) as exact
// (platform, category_slug) -> (seller category, segment) rows, and the
// seller's scope over it lives in `seller_market_definitions`. A seller who
// never opens the editor gets a default scope identical in spirit to the old
// behaviour - every mapped segment, no price band - so nothing regresses; they
// simply gain the ability to narrow it.

export type MarketTaxonomyNode = {
  platformId: string;
  platformName: string;
  categorySlug: string;
  segmentSlug: string;
  segmentLabel: string;
};

export type MarketSegment = {
  slug: string;
  label: string;
  platformNames: string[];
  nodeCount: number;
};

export type MarketDefinition = {
  sellerCategorySlug: string;
  includedSegments: string[];
  excludedPlatformIds: string[];
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string;
  brands: string[];
  cities: string[];
  /** True when no row exists yet and this is the implicit "everything" scope. */
  isDefault: boolean;
};

export type ScopeRow = {
  categorySlug: string | null;
  platformId?: string | null;
  /** Already converted into `definition.priceCurrency` by the caller. */
  price?: number | null;
  brand?: string | null;
  city?: string | null;
};

export type MarketScope = {
  sellerCategorySlug: string;
  definition: MarketDefinition;
  /** Every segment mapped to this category, whether or not it is in scope. */
  allSegments: MarketSegment[];
  activeSegments: MarketSegment[];
  /**
   * The exact scraped slugs in scope. Pass straight to `.in('category_slug', …)`
   * so the database does the filtering instead of pulling the table into JS
   * and testing a regex per row (ROADMAP.md A4, in part).
   */
  categorySlugs: string[];
  activePlatformIds: string[];
  /** False when this seller category has no taxonomy at all (e.g. `other`). */
  hasTaxonomy: boolean;
  matchesCategory: (categorySlug: string | null | undefined) => boolean;
  matchesRow: (row: ScopeRow) => boolean;
};

function defaultDefinition(sellerCategorySlug: string): MarketDefinition {
  return {
    sellerCategorySlug,
    includedSegments: [],
    excludedPlatformIds: [],
    priceMin: null,
    priceMax: null,
    priceCurrency: 'PKR',
    brands: [],
    cities: [],
    isDefault: true,
  };
}

async function loadTaxonomy(sellerCategorySlug: string): Promise<MarketTaxonomyNode[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('market_category_map')
    .select('platform_id, category_slug, segment_slug, segment_label, market_platforms(name)')
    .eq('seller_category_slug', sellerCategorySlug);

  if (error || !data) return [];

  return data.map((row: any) => {
    const platform = Array.isArray(row.market_platforms) ? row.market_platforms[0] : row.market_platforms;
    return {
      platformId: row.platform_id,
      platformName: platform?.name ?? 'Unknown',
      categorySlug: row.category_slug,
      segmentSlug: row.segment_slug,
      segmentLabel: row.segment_label,
    };
  });
}

async function loadDefinition(sellerId: string, sellerCategorySlug: string): Promise<MarketDefinition> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('seller_market_definitions')
    .select('included_segments, excluded_platform_ids, price_min, price_max, price_currency, brands, cities')
    .eq('seller_id', sellerId)
    .eq('seller_category_slug', sellerCategorySlug)
    .maybeSingle();

  if (error || !data) return defaultDefinition(sellerCategorySlug);

  return {
    sellerCategorySlug,
    includedSegments: data.included_segments ?? [],
    excludedPlatformIds: data.excluded_platform_ids ?? [],
    priceMin: data.price_min != null ? Number(data.price_min) : null,
    priceMax: data.price_max != null ? Number(data.price_max) : null,
    priceCurrency: data.price_currency ?? 'PKR',
    brands: data.brands ?? [],
    cities: data.cities ?? [],
    isDefault: false,
  };
}

function summariseSegments(nodes: MarketTaxonomyNode[]): MarketSegment[] {
  const bySlug = new Map<string, { label: string; platforms: Set<string>; count: number }>();
  for (const node of nodes) {
    const entry = bySlug.get(node.segmentSlug) ?? { label: node.segmentLabel, platforms: new Set<string>(), count: 0 };
    entry.platforms.add(node.platformName);
    entry.count += 1;
    bySlug.set(node.segmentSlug, entry);
  }
  return Array.from(bySlug.entries())
    .map(([slug, entry]) => ({
      slug,
      label: entry.label,
      platformNames: Array.from(entry.platforms).sort(),
      nodeCount: entry.count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The seller's market as an object every analysis module can filter against.
 *
 * `sellerId` is optional so the existing call sites, which only ever had a
 * category slug to hand, can adopt this without threading a seller through
 * five layers. When omitted it resolves the signed-in seller; when there is no
 * session it falls back to the default (unnarrowed) scope, which is the right
 * answer for the report generator and cron jobs.
 */
export async function getMarketScope(sellerCategorySlug: string, sellerId?: string): Promise<MarketScope> {
  const resolvedSellerId = sellerId ?? (await getCurrentSeller())?.id;

  const [nodes, definition] = await Promise.all([
    loadTaxonomy(sellerCategorySlug),
    resolvedSellerId
      ? loadDefinition(resolvedSellerId, sellerCategorySlug)
      : Promise.resolve(defaultDefinition(sellerCategorySlug)),
  ]);

  const allSegments = summariseSegments(nodes);

  // An empty `included_segments` means "all of them", not "none". See the
  // column comment in migration 020 - it keeps the zero-config default from
  // rendering an empty dashboard for every seller who has not opened the
  // editor yet.
  const included = new Set(definition.includedSegments);
  const excludedPlatforms = new Set(definition.excludedPlatformIds);
  const inScope = nodes.filter(
    (node) => (included.size === 0 || included.has(node.segmentSlug)) && !excludedPlatforms.has(node.platformId),
  );

  const categorySlugs = Array.from(new Set(inScope.map((node) => node.categorySlug)));
  const slugSet = new Set(categorySlugs);
  const activePlatformIds = Array.from(new Set(inScope.map((node) => node.platformId)));
  const activePlatformSet = new Set(activePlatformIds);

  const brandSet = new Set(definition.brands.map((b) => b.trim().toLowerCase()).filter(Boolean));
  const citySet = new Set(definition.cities.map((c) => c.trim().toLowerCase()).filter(Boolean));

  const matchesCategory = (categorySlug: string | null | undefined): boolean =>
    !!categorySlug && slugSet.has(categorySlug);

  const matchesRow = (row: ScopeRow): boolean => {
    if (!matchesCategory(row.categorySlug)) return false;
    // platformId is only checked when the caller actually selected it. A row
    // whose slug is in scope already came from an in-scope platform, since the
    // taxonomy is keyed on the pair - this is belt and braces for callers that
    // query across platforms.
    if (row.platformId && !activePlatformSet.has(row.platformId)) return false;
    if (row.price != null) {
      if (definition.priceMin != null && row.price < definition.priceMin) return false;
      if (definition.priceMax != null && row.price > definition.priceMax) return false;
    }
    if (brandSet.size > 0 && !brandSet.has((row.brand ?? '').trim().toLowerCase())) return false;
    // Geography only exists on classifieds. Retailer rows have no city, so a
    // city filter must not silently delete them from the market.
    if (citySet.size > 0 && row.city != null && !citySet.has(row.city.trim().toLowerCase())) return false;
    return true;
  };

  return {
    sellerCategorySlug,
    definition,
    allSegments,
    activeSegments: allSegments.filter((s) => included.size === 0 || included.has(s.slug)),
    categorySlugs,
    activePlatformIds,
    hasTaxonomy: nodes.length > 0,
    matchesCategory,
    matchesRow,
  };
}

/**
 * The seller's market across EVERY tracked domain at once, not just one
 * category - for the Competitors page's "All My Products" view. Unions each
 * domain's own `getMarketScope()` result (categorySlugs, activePlatformIds)
 * rather than a new SQL path: `market_competitor_scorecards`/
 * `market_scope_price_stats` already accept these as arrays, so a unioned
 * array is a valid input to the exact same RPCs every per-domain call uses.
 *
 * `definition` is deliberately the plain default (no price band/brands/
 * cities) - each domain's own custom filters don't compose meaningfully
 * across categories (a price band tuned for "Mobiles & Electronics" is
 * meaningless applied to "Grocery & Food" too), so the aggregate view always
 * shows the full unfiltered picture across everything tracked. A seller who
 * wants a narrowed view of one category still has that category's own
 * Market Definition page for it.
 */
export async function getMarketScopeForAllDomains(sellerId: string): Promise<MarketScope> {
  const slugs = await listSellerDomainSlugs(sellerId);

  const empty: MarketScope = {
    sellerCategorySlug: 'all',
    definition: defaultDefinition('all'),
    allSegments: [],
    activeSegments: [],
    categorySlugs: [],
    activePlatformIds: [],
    hasTaxonomy: false,
    matchesCategory: () => false,
    matchesRow: () => false,
  };
  if (slugs.length === 0) return empty;

  const scopes = await Promise.all(slugs.map((slug) => getMarketScope(slug, sellerId)));

  const categorySlugs = Array.from(new Set(scopes.flatMap((s) => s.categorySlugs)));
  const activePlatformIds = Array.from(new Set(scopes.flatMap((s) => s.activePlatformIds)));
  const allSegments = mergeSegments(scopes.flatMap((s) => s.allSegments));
  const slugSet = new Set(categorySlugs);
  const activePlatformSet = new Set(activePlatformIds);

  const matchesCategory = (categorySlug: string | null | undefined): boolean =>
    !!categorySlug && slugSet.has(categorySlug);

  const matchesRow = (row: ScopeRow): boolean => {
    if (!matchesCategory(row.categorySlug)) return false;
    if (row.platformId && !activePlatformSet.has(row.platformId)) return false;
    return true;
  };

  return {
    sellerCategorySlug: 'all',
    definition: defaultDefinition('all'),
    allSegments,
    activeSegments: allSegments,
    categorySlugs,
    activePlatformIds,
    hasTaxonomy: scopes.some((s) => s.hasTaxonomy),
    matchesCategory,
    matchesRow,
  };
}

// Segments of the same slug can appear in multiple domains' taxonomies
// (e.g. two categories both have a "beauty" segment from different
// platforms) - merge by slug so the union doesn't show duplicate rows.
function mergeSegments(segments: MarketSegment[]): MarketSegment[] {
  const bySlug = new Map<string, MarketSegment>();
  for (const segment of segments) {
    const existing = bySlug.get(segment.slug);
    if (!existing) {
      bySlug.set(segment.slug, { ...segment, platformNames: [...segment.platformNames] });
      continue;
    }
    existing.platformNames = Array.from(new Set([...existing.platformNames, ...segment.platformNames])).sort();
    existing.nodeCount += segment.nodeCount;
  }
  return Array.from(bySlug.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export type TaxonomyPlatform = { id: string; name: string };

/**
 * The platforms that actually carry this seller category, for the exclusion
 * list in the editor. Read from the taxonomy rather than from
 * `market_platforms` wholesale, so a seller is never offered the chance to
 * exclude a platform that was never in their market to begin with.
 */
export async function listTaxonomyPlatforms(sellerCategorySlug: string): Promise<TaxonomyPlatform[]> {
  const nodes = await loadTaxonomy(sellerCategorySlug);
  const byId = new Map<string, string>();
  for (const node of nodes) byId.set(node.platformId, node.platformName);
  return Array.from(byId.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type MarketDefinitionInput = {
  sellerCategorySlug: string;
  includedSegments: string[];
  excludedPlatformIds: string[];
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string;
  brands: string[];
  cities: string[];
};

export async function saveMarketDefinition(sellerId: string, input: MarketDefinitionInput): Promise<void> {
  const supabase = await createClient();

  // Selecting every segment is stored as "no restriction" rather than as the
  // full list, so a segment added to the taxonomy later widens the market
  // instead of being excluded by an out-of-date saved snapshot.
  const allSegments = summariseSegments(await loadTaxonomy(input.sellerCategorySlug));
  const included =
    input.includedSegments.length === allSegments.length ? [] : input.includedSegments;

  const { error } = await supabase.from('seller_market_definitions').upsert(
    {
      seller_id: sellerId,
      seller_category_slug: input.sellerCategorySlug,
      included_segments: included,
      excluded_platform_ids: input.excludedPlatformIds,
      price_min: input.priceMin,
      price_max: input.priceMax,
      price_currency: input.priceCurrency,
      brands: input.brands.map((b) => b.trim()).filter(Boolean),
      cities: input.cities.map((c) => c.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'seller_id,seller_category_slug' },
  );

  if (error) throw new Error(error.message);
}

/**
 * Everything the C2 banner needs to state the seller's market back to them in
 * one line. Lives here rather than in the component so the server can build it
 * and hand a plain object across the boundary, matching how every other page
 * in this app splits fetching from rendering.
 */
export type MarketScopeSummary = {
  categoryName: string;
  productCount: number;
  listingCount: number;
  platformNames: string[];
  segmentLabels: string[];
  totalSegmentCount: number;
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string;
  brands: string[];
  cities: string[];
  isDefault: boolean;
  hasTaxonomy: boolean;
};

export async function getMarketScopeSummary(
  sellerCategorySlug: string,
  categoryName: string,
  sellerId?: string,
): Promise<MarketScopeSummary> {
  const scope = await getMarketScope(sellerCategorySlug, sellerId);
  const coverage = await getMarketScopeCoverage(scope);

  return {
    categoryName,
    productCount: coverage.productCount,
    listingCount: coverage.listingCount,
    platformNames: coverage.platformNames,
    segmentLabels: scope.activeSegments.map((s) => s.label),
    totalSegmentCount: scope.allSegments.length,
    priceMin: scope.definition.priceMin,
    priceMax: scope.definition.priceMax,
    priceCurrency: scope.definition.priceCurrency,
    brands: scope.definition.brands,
    cities: scope.definition.cities,
    isDefault: scope.definition.isDefault,
    hasTaxonomy: scope.hasTaxonomy,
  };
}

export type MarketScopeCoverage = {
  productCount: number;
  listingCount: number;
  platformNames: string[];
};

/**
 * What the scope actually resolves to, for the "N listings across M platforms
 * match your definition" line C2 requires on every analysis page.
 *
 * Sourced from market_scope_coverage() (migration 041) rather than two plain
 * PostgREST counts, so this always applies the seller's full definition
 * (price band, brands, cities) - not just category/platform. Before 041 this
 * counted category+platform only while getCategoryPricing()'s stats call
 * applied the full definition, so the banner could claim thousands of
 * listings while every figure on the page was computed over a filtered
 * fraction of them - and a band matching zero rows never triggered the
 * honest empty state, because the unfiltered count was still positive.
 */
export async function getMarketScopeCoverage(scope: MarketScope): Promise<MarketScopeCoverage> {
  if (scope.categorySlugs.length === 0) {
    return { productCount: 0, listingCount: 0, platformNames: [] };
  }

  const supabase = await createClient();
  const fxRates = await getLatestFxRates();

  const { data, error } = await supabase
    .rpc('market_scope_coverage', {
      p_category_slugs: scope.categorySlugs,
      p_platform_ids: scope.activePlatformIds,
      p_band_currency: scope.definition.priceCurrency,
      p_rates: fxRates,
      p_price_min: scope.definition.priceMin,
      p_price_max: scope.definition.priceMax,
      p_brands: scope.definition.brands,
      p_cities: scope.definition.cities,
    })
    .maybeSingle<{ product_count: number | string | null; listing_count: number | string | null; platform_ids: string[] | null }>();

  if (error || !data) return { productCount: 0, listingCount: 0, platformNames: [] };

  const platformIds = data.platform_ids ?? [];
  const platformNames =
    platformIds.length === 0
      ? []
      : (
          await supabase.from('market_platforms').select('name').in('id', platformIds)
        ).data?.map((p: { name: string }) => p.name).sort() ?? [];

  return {
    productCount: Number(data.product_count ?? 0),
    listingCount: Number(data.listing_count ?? 0),
    platformNames,
  };
}
