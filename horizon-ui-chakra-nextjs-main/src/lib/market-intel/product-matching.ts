'server-only';

import { createClient } from '@/lib/supabase/server';
import { CATEGORY_KEYWORDS } from '@/lib/market-intel/category-keywords';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';

// MVP-level matching: token-overlap (Jaccard) similarity on normalized
// titles. market_product_matches (009_product_matches.sql) already models
// confidence-scored product pairs, but only mobiles currently has a real
// matcher behind it. Extending that to fashion/other categories properly
// needs an embeddings-based fuzzy match on title+brand+price (a real model
// choice + likely a vector column) - deliberately not built here to avoid
// picking an embedding provider/infra without a decision. This gives sellers
// a directional "closest competitor listing" signal today using only
// string comparison, no new infra, while that decision is made.
const STOPWORDS = new Set(['the', 'a', 'an', 'for', 'with', 'and', 'of', 'in', 'pack', 'pcs']);

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1 && !STOPWORDS.has(token)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

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

const MIN_CONFIDENCE = 0.3;
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
  const keywordPattern = CATEGORY_KEYWORDS[categorySlug];
  if (!keywordPattern) return [];

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
      .limit(MAX_MARKET_CANDIDATES),
    getLatestFxRates(),
  ]);

  if (sellerProductsRes.error || !sellerProductsRes.data) return [];
  if (marketProductsRes.error || !marketProductsRes.data) return [];

  const candidates = marketProductsRes.data
    .filter((row) => row.category_slug && keywordPattern.test(row.category_slug))
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
