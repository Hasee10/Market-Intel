import 'server-only';

import { MIN_COMPETITOR_CONFIDENCE } from '@/lib/market-intel/core/similarity';
import { getMarketScope } from '@/lib/market-intel/market/market-definition';
import { createClient } from '@/lib/supabase/server';

// Demand index: how much demand the market shows for each of the seller's
// products, 0-100, from the signals the scraper reports.
//
// "Search volume (how many clicks done)" on the product notes. Nothing here
// sees searches or clicks, so this is a percentile: for each product's
// best-matched listing, where it sits among every listing in the same
// category on sold count, review count, and page position (rank, 060).
// A product at 80 is showing more demand than roughly four in five listings
// in its category. The database does the ranking (migration 061) so the
// category-wide windows never come over the wire.
//
// Weights: sales 45, reviews 35, position 20. Sales are the most direct
// evidence of demand and reviews the next; position is where the platform
// itself chose to put the listing, which reflects demand but also the
// platform's own sort. A signal the listing does not have (no sold count
// on most non-Daraz platforms; no rank until a listing has been observed
// since 2026-09-18) is dropped for that product and the remaining weights
// rescaled - per product, unlike the placement score, because this index
// is read on its own, not compared across a row of platforms.
//
// One RPC call per seller category the products fall in, each scoped to
// that category's market definition. A product with no confirmed match has
// no index: there is no listing to measure. The Products page shows a dash,
// not a zero.

const WEIGHTS = { sales: 45, reviews: 35, position: 20 } as const;
type Signal = keyof typeof WEIGHTS;

export type DemandIndex = {
  index: number;
  /** Percentiles 0-1 for the signals the listing has; null where it does not. */
  soldPct: number | null;
  reviewsPct: number | null;
  rankPct: number | null;
  soldCount: number | null;
  ratingCount: number | null;
  latestRank: number | null;
  /** Listings in the category the percentiles were taken over. */
  categoryListings: number;
  signalsUsed: Signal[];
};

type MatchRow = {
  seller_product_id: string;
  market_product_id: string;
  confidence: number | string;
  seller_products: { category_id: string | null; seller_categories: { slug: string } | { slug: string }[] | null } | null;
};

type PctRow = {
  product_id: string;
  sold_count: number | null;
  rating_count: number | null;
  latest_rank: number | null;
  sold_pct: number | string | null;
  reviews_pct: number | string | null;
  rank_pct: number | string | null;
  category_listings: number | string;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function num(v: number | string | null | undefined): number | null {
  return v == null ? null : Number(v);
}

export function computeIndex(row: { soldPct: number | null; reviewsPct: number | null; rankPct: number | null }): {
  index: number;
  signalsUsed: Signal[];
} {
  const parts: [Signal, number | null][] = [
    ['sales', row.soldPct],
    ['reviews', row.reviewsPct],
    ['position', row.rankPct],
  ];
  const used = parts.filter((p): p is [Signal, number] => p[1] != null);
  const weightTotal = used.reduce((s, [k]) => s + WEIGHTS[k], 0);
  if (weightTotal === 0) return { index: 0, signalsUsed: [] };
  const raw = used.reduce((s, [k, v]) => s + v * WEIGHTS[k], 0) / weightTotal;
  return { index: Math.round(raw * 100), signalsUsed: used.map(([k]) => k) };
}

export async function getDemandIndexes(sellerId: string): Promise<Map<string, DemandIndex>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_product_competitor_matches')
    .select(
      'seller_product_id, market_product_id, confidence, seller_products!inner(category_id, seller_categories(slug))',
    )
    .eq('seller_id', sellerId)
    .gte('confidence', MIN_COMPETITOR_CONFIDENCE);

  if (error) throw new Error(error.message);

  // Best listing per seller product, bucketed by the seller category whose
  // market scope it will be measured against.
  const best = new Map<string, { listingId: string; confidence: number; categorySlug: string }>();
  for (const m of (data ?? []) as unknown as MatchRow[]) {
    const slug = one(m.seller_products?.seller_categories)?.slug;
    if (!slug) continue;
    const conf = Number(m.confidence);
    const cur = best.get(m.seller_product_id);
    if (!cur || conf > cur.confidence) {
      best.set(m.seller_product_id, { listingId: m.market_product_id, confidence: conf, categorySlug: slug });
    }
  }
  if (best.size === 0) return new Map();

  const byCategory = new Map<string, string[]>();
  for (const { listingId, categorySlug } of best.values()) {
    byCategory.set(categorySlug, [...(byCategory.get(categorySlug) ?? []), listingId]);
  }

  const pctByListing = new Map<string, PctRow>();
  await Promise.all(
    Array.from(byCategory.entries()).map(async ([categorySlug, listingIds]) => {
      const scope = await getMarketScope(categorySlug, sellerId);
      if (scope.categorySlugs.length === 0 || scope.activePlatformIds.length === 0) return;
      const { data: rows, error: rpcError } = await supabase.rpc('market_demand_percentiles', {
        p_category_slugs: scope.categorySlugs,
        p_platform_ids: scope.activePlatformIds,
        p_product_ids: listingIds,
      });
      if (rpcError) throw new Error(rpcError.message);
      for (const r of (rows ?? []) as PctRow[]) pctByListing.set(r.product_id, r);
    }),
  );

  const result = new Map<string, DemandIndex>();
  for (const [sellerProductId, { listingId }] of best) {
    const r = pctByListing.get(listingId);
    if (!r) continue;
    const pcts = { soldPct: num(r.sold_pct), reviewsPct: num(r.reviews_pct), rankPct: num(r.rank_pct) };
    const { index, signalsUsed } = computeIndex(pcts);
    result.set(sellerProductId, {
      index,
      ...pcts,
      soldCount: r.sold_count,
      ratingCount: r.rating_count,
      latestRank: r.latest_rank,
      categoryListings: Number(r.category_listings),
      signalsUsed,
    });
  }
  return result;
}
