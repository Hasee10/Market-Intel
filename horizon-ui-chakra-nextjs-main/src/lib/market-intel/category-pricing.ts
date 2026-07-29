'server-only';

import { createClient } from '@/lib/supabase/server';
import { CATEGORY_KEYWORDS } from '@/lib/market-intel/category-keywords';

export type CategoryPricing = {
  categorySlug: string;
  count: number;
  minPrice: number;
  p25: number;
  median: number;
  p75: number;
  maxPrice: number;
  avgPrice: number;
  samplePlatforms: string[];
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// Market-wide competitor pricing, sourced from the scraper's market_products
// table (same Supabase project as of 2026-07-28, see scraper/.env) - this is
// raw scraped marketplace data, unrelated to domain_benchmarks (which is
// computed from our own sellers' opted-in data). Returns null if this
// seller's category has no keyword mapping yet, or no scraped rows match.
export async function getCategoryPricing(sellerCategorySlug: string): Promise<CategoryPricing | null> {
  const keywordPattern = CATEGORY_KEYWORDS[sellerCategorySlug];
  if (!keywordPattern) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('market_products')
    .select('price, category_slug, market_platforms(name)')
    .eq('is_active', true)
    .not('price', 'is', null);

  if (error || !data) return null;

  const matched = data.filter((row) => row.category_slug && keywordPattern.test(row.category_slug));
  if (matched.length === 0) return null;

  const prices = matched.map((row) => Number(row.price)).sort((a, b) => a - b);
  const platformNames = new Set<string>();
  for (const row of matched) {
    const platform = Array.isArray(row.market_platforms) ? row.market_platforms[0] : row.market_platforms;
    if (platform?.name) platformNames.add(platform.name);
  }

  const sum = prices.reduce((acc, price) => acc + price, 0);

  return {
    categorySlug: sellerCategorySlug,
    count: prices.length,
    minPrice: prices[0],
    p25: percentile(prices, 0.25),
    median: percentile(prices, 0.5),
    p75: percentile(prices, 0.75),
    maxPrice: prices[prices.length - 1],
    avgPrice: sum / prices.length,
    samplePlatforms: Array.from(platformNames).slice(0, 5),
  };
}
