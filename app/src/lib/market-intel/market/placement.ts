import 'server-only';

import { MIN_COMPETITOR_CONFIDENCE } from '@/lib/market-intel/core/similarity';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';
import { createClient } from '@/lib/supabase/server';

// Where one of the seller's products is listed across the market, and which
// platform shows the most demand for it.
//
// Two items from the product notes (2026-09-18) land here: "same product on
// multiple websites → which is the best traffic gateway" and "historical
// chart → our product placement". Both are built entirely on data that
// already exists - seller_product_competitor_matches (028) links the
// seller's product to matched market listings, and market_price_history
// (001) has every price and stock observation for each of them. Nothing in
// the scraper changes.
//
// On "traffic". The scraper does not see traffic and no marketplace here
// publishes it, so the score is a DEMAND proxy from what is captured:
// platform-reported sold counts, review counts, rating, and how often the
// listing was in stock. It is labelled that way on screen. Price is
// deliberately not in the score - a higher price on one platform is good
// for margin and bad for competitiveness, and that is the seller's call,
// so it is shown beside the score as a fact.
//
// On "placement". The chart is price and stock over time. Position on the
// category page is not scraped today; when it is (a scraper change, scoped
// separately), it joins this series. The response says so rather than
// leaving a gap the client has to explain.
//
// Score weights sum to 100 and every component is returned, so the client
// can show why a platform leads. A signal that no platform has for this
// product (sold counts are not published everywhere) is dropped and the
// remaining weights are rescaled - otherwise every platform would score 0
// on it for a reason the seller cannot see.

export const HISTORY_DAYS = 90;
export const AVAILABILITY_WINDOW_DAYS = 30;

const WEIGHTS = { sales: 40, reviews: 30, rating: 15, availability: 15 } as const;
type Signal = keyof typeof WEIGHTS;

export type PlacementPoint = { date: string; price: number | null; inStock: boolean };

export type PlatformPlacement = {
  platformName: string;
  marketProductId: string;
  title: string;
  url: string;
  imageUrl: string | null;
  confidence: number;
  /** Other matched listings on this same platform, collapsed into this row. */
  otherListingsOnPlatform: number;
  price: number | null;
  currency: string;
  inStock: boolean;
  rating: number | null;
  ratingCount: number | null;
  soldCount: number | null;
  /** Share of observations in the last AVAILABILITY_WINDOW_DAYS with in_stock true. Null with no observations. */
  availability: number | null;
  score: number;
  /** Each component's contribution to `score`, already weighted. Null = signal not available for any platform. */
  components: Record<Signal, number | null>;
  history: PlacementPoint[];
};

export type ProductPlacement = {
  sellerProductId: string;
  sellerProductTitle: string;
  sellerPrice: number | null;
  currency: string;
  platforms: PlatformPlacement[];
  /** platformName of the top-scoring platform, or null with no listings. */
  bestPlatform: string | null;
  /** Signals that were actually available and therefore scored. */
  signalsUsed: Signal[];
  historyDays: number;
  /** Stated once, for the client to show: what this is and is not. */
  caveats: string[];
};

type MatchRow = {
  confidence: number | string;
  market_products: {
    id: string;
    title: string;
    url: string;
    image_url: string | null;
    price: number | string | null;
    currency: string;
    in_stock: boolean;
    rating: number | string | null;
    rating_count: number | null;
    sold_count: number | null;
    platform_id: string;
    market_platforms: { name: string } | { name: string }[] | null;
  } | null;
};

type HistoryRow = { product_id: string; price: number | string | null; in_stock: boolean; recorded_at: string };

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// Linear share of the best value across platforms, 0..1. The "best" for
// every signal here is the largest; price is not scored (see header).
function share(value: number | null, max: number): number | null {
  if (value == null || max <= 0) return null;
  return Math.min(value / max, 1);
}

export function scorePlatforms(
  rows: Omit<PlatformPlacement, 'score' | 'components'>[],
): { scored: PlatformPlacement[]; signalsUsed: Signal[] } {
  const maxSold = Math.max(0, ...rows.map((r) => r.soldCount ?? 0));
  const maxReviews = Math.max(0, ...rows.map((r) => r.ratingCount ?? 0));

  // A signal counts as available if ANY platform reports it.
  const available: Record<Signal, boolean> = {
    sales: rows.some((r) => r.soldCount != null),
    reviews: rows.some((r) => r.ratingCount != null),
    rating: rows.some((r) => r.rating != null),
    availability: rows.some((r) => r.availability != null),
  };
  const signalsUsed = (Object.keys(WEIGHTS) as Signal[]).filter((s) => available[s]);
  const weightTotal = signalsUsed.reduce((sum, s) => sum + WEIGHTS[s], 0);
  const scale = weightTotal > 0 ? 100 / weightTotal : 0;

  const scored = rows.map((r) => {
    const raw: Record<Signal, number | null> = {
      sales: available.sales ? share(r.soldCount, maxSold) ?? 0 : null,
      reviews: available.reviews ? share(r.ratingCount, maxReviews) ?? 0 : null,
      rating: available.rating ? (r.rating != null ? Math.min(r.rating / 5, 1) : 0) : null,
      availability: available.availability ? r.availability ?? 0 : null,
    };
    const components: Record<Signal, number | null> = {
      sales: raw.sales == null ? null : Number((raw.sales * WEIGHTS.sales * scale).toFixed(1)),
      reviews: raw.reviews == null ? null : Number((raw.reviews * WEIGHTS.reviews * scale).toFixed(1)),
      rating: raw.rating == null ? null : Number((raw.rating * WEIGHTS.rating * scale).toFixed(1)),
      availability:
        raw.availability == null ? null : Number((raw.availability * WEIGHTS.availability * scale).toFixed(1)),
    };
    const score = Number(
      (Object.values(components).reduce<number>((sum, v) => sum + (v ?? 0), 0)).toFixed(0),
    );
    return { ...r, score, components };
  });

  scored.sort((a, b) => b.score - a.score || (b.ratingCount ?? 0) - (a.ratingCount ?? 0));
  return { scored, signalsUsed };
}

export async function getProductPlacement(
  sellerId: string,
  sellerProductId: string,
  reportingCurrency: string,
): Promise<ProductPlacement> {
  const supabase = await createClient();

  const [productRes, matchesRes, fxRates] = await Promise.all([
    supabase
      .from('seller_products')
      .select('id, title, sell_price, currency')
      .eq('id', sellerProductId)
      .eq('seller_id', sellerId)
      .maybeSingle(),
    supabase
      .from('seller_product_competitor_matches')
      .select(
        'confidence, market_products!inner(id, title, url, image_url, price, currency, in_stock, rating, rating_count, sold_count, platform_id, market_platforms(name))',
      )
      .eq('seller_id', sellerId)
      .eq('seller_product_id', sellerProductId)
      .gte('confidence', MIN_COMPETITOR_CONFIDENCE)
      .eq('market_products.is_active', true),
    getLatestFxRates(),
  ]);

  if (productRes.error) throw new Error(productRes.error.message);
  if (!productRes.data) throw new Error('Product not found');
  if (matchesRes.error) throw new Error(matchesRes.error.message);

  const product = productRes.data;
  const sellerPrice =
    product.sell_price != null
      ? convertCurrency(Number(product.sell_price), product.currency ?? 'PKR', reportingCurrency, fxRates)
      : null;

  // One row per platform: the highest-confidence listing represents it,
  // the rest are counted so a collapsed row is visibly collapsed.
  const byPlatform = new Map<string, { row: MatchRow; extra: number }>();
  for (const m of (matchesRes.data ?? []) as unknown as MatchRow[]) {
    const mp = m.market_products;
    if (!mp) continue;
    const name = one(mp.market_platforms)?.name ?? 'Unknown platform';
    const existing = byPlatform.get(name);
    if (!existing) byPlatform.set(name, { row: m, extra: 0 });
    else if (Number(m.confidence) > Number(existing.row.confidence)) byPlatform.set(name, { row: m, extra: existing.extra + 1 });
    else existing.extra += 1;
  }

  const listingIds = Array.from(byPlatform.values()).map((v) => v.row.market_products!.id);
  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const availabilitySince = Date.now() - AVAILABILITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  let history: HistoryRow[] = [];
  if (listingIds.length > 0) {
    const histRes = await supabase
      .from('market_price_history')
      .select('product_id, price, in_stock, recorded_at')
      .in('product_id', listingIds)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });
    if (histRes.error) throw new Error(histRes.error.message);
    history = (histRes.data ?? []) as HistoryRow[];
  }

  const historyByListing = new Map<string, HistoryRow[]>();
  for (const h of history) {
    const arr = historyByListing.get(h.product_id) ?? [];
    arr.push(h);
    historyByListing.set(h.product_id, arr);
  }

  const unscored = Array.from(byPlatform.entries()).map(([platformName, { row, extra }]) => {
    const mp = row.market_products!;
    const rows = historyByListing.get(mp.id) ?? [];
    const recent = rows.filter((h) => new Date(h.recorded_at).getTime() >= availabilitySince);
    const availability =
      recent.length > 0 ? Number((recent.filter((h) => h.in_stock).length / recent.length).toFixed(2)) : null;

    return {
      platformName,
      marketProductId: mp.id,
      title: mp.title,
      url: mp.url,
      imageUrl: mp.image_url,
      confidence: Number(row.confidence),
      otherListingsOnPlatform: extra,
      price: mp.price != null ? convertCurrency(Number(mp.price), mp.currency, reportingCurrency, fxRates) : null,
      currency: reportingCurrency,
      inStock: mp.in_stock,
      rating: mp.rating != null ? Number(mp.rating) : null,
      ratingCount: mp.rating_count,
      soldCount: mp.sold_count,
      availability,
      history: rows.map((h) => ({
        date: h.recorded_at.slice(0, 10),
        price: h.price != null ? convertCurrency(Number(h.price), mp.currency, reportingCurrency, fxRates) : null,
        inStock: h.in_stock,
      })),
    };
  });

  const { scored, signalsUsed } = scorePlatforms(unscored);

  const caveats = [
    'The score is a demand proxy from platform-reported sold counts, reviews, rating and availability - not measured traffic, which no marketplace here publishes.',
    'Price is shown but not scored: a higher price on one platform is good for margin and bad for competitiveness, and that trade-off is yours.',
    'Position on the category page is not captured yet, so the history is price and stock only.',
  ];
  if (signalsUsed.length < 4) {
    const missing = (Object.keys(WEIGHTS) as Signal[]).filter((s) => !signalsUsed.includes(s));
    caveats.push(`No platform reports ${missing.join(' or ')} for this product, so the score is built from the rest.`);
  }

  return {
    sellerProductId: product.id,
    sellerProductTitle: product.title,
    sellerPrice,
    currency: reportingCurrency,
    platforms: scored,
    bestPlatform: scored[0]?.platformName ?? null,
    signalsUsed,
    historyDays: HISTORY_DAYS,
    caveats,
  };
}
