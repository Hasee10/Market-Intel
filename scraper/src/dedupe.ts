// Cross-source duplicate detection, folded into the main pipeline (see
// pipeline.ts) so it stays current every scrape run instead of needing its
// own schedule - this replaced a standalone `match-products.ts` script that
// nothing ever actually scheduled. Populates market_product_matches
// (migrations/009) with pairs of active products, from different platforms,
// judged to be the same physical listing - see matching.ts for the scoring.
import { config, requireDatabase } from './config.js';
import { findMatches, MATCH_THRESHOLD, type MatchableProduct, type MatchPair } from './matching.js';

// Above this many active products in one canonical category, skip the
// pairwise (O(n^2)) pass for that category rather than let it run unbounded -
// the catalog keeps growing (fashion-and-apparel alone is already estimated
// at 9,000-12,000+ active rows), and a silent multi-hour pairwise pass would
// blow the pipeline's runtime unpredictably on some future scrape.
const MAX_BUCKET_SIZE = 5000;

const MOBILE_SELLER_CATEGORY = 'mobiles-and-electronics';

const PAGE_SIZE = 1000;

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: config.supabaseServiceRoleKey,
    Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

type CategoryMapRow = { platform_id: string; category_slug: string; seller_category_slug: string };

async function fetchCategoryMap(): Promise<Map<string, string>> {
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/market_category_map?select=platform_id,category_slug,seller_category_slug`,
    { headers: headers() },
  );
  if (!res.ok) {
    throw new Error(`Failed to load market_category_map: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as CategoryMapRow[];
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(`${row.platform_id}:${row.category_slug}`, row.seller_category_slug);
  }
  return map;
}

type PlatformRow = { id: string; slug: string };
type ProductRow = { id: string; platform_id: string; category_slug: string | null; title: string; price: number };

async function fetchPlatformSlugs(): Promise<Map<string, string>> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/market_platforms?select=id,slug`, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Failed to load market_platforms: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as PlatformRow[];
  return new Map(rows.map((p) => [p.id, p.slug]));
}

async function fetchActiveProducts(): Promise<ProductRow[]> {
  const products: ProductRow[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/market_products?is_active=eq.true&price=not.is.null&select=id,platform_id,category_slug,title,price&order=id.asc&offset=${offset}&limit=${PAGE_SIZE}`,
      { headers: headers() },
    );
    if (!res.ok) {
      throw new Error(`Failed to load active products: ${res.status} ${await res.text()}`);
    }
    const page = (await res.json()) as ProductRow[];
    products.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return products;
}

function bucketByCanonicalCategory(
  products: ProductRow[],
  categoryMap: Map<string, string>,
  platformSlugs: Map<string, string>,
): Map<string, MatchableProduct[]> {
  const buckets = new Map<string, MatchableProduct[]>();
  for (const p of products) {
    if (!p.category_slug) continue;
    const sellerCategory = categoryMap.get(`${p.platform_id}:${p.category_slug}`);
    const platformSlug = platformSlugs.get(p.platform_id);
    if (!sellerCategory || !platformSlug) continue;

    const bucket = buckets.get(sellerCategory) ?? [];
    bucket.push({ id: p.id, platformSlug, title: p.title, price: p.price });
    buckets.set(sellerCategory, bucket);
  }
  return buckets;
}

async function replaceMatches(pairs: MatchPair[]): Promise<void> {
  // Recomputed from scratch each run - simplest way to stay consistent with
  // is_active flips (delisted products should drop out of the match table,
  // not linger with a stale confidence score).
  const deleteRes = await fetch(`${config.supabaseUrl}/rest/v1/market_product_matches?id=not.is.null`, {
    method: 'DELETE',
    headers: headers({ Prefer: 'return=minimal' }),
  });
  if (!deleteRes.ok) {
    throw new Error(`Failed to clear market_product_matches: ${deleteRes.status} ${await deleteRes.text()}`);
  }

  if (!pairs.length) return;

  const rows = pairs.map((p) => ({
    product_a_id: p.productAId,
    product_b_id: p.productBId,
    confidence: Number(p.confidence.toFixed(3)),
  }));

  const insertRes = await fetch(`${config.supabaseUrl}/rest/v1/market_product_matches`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!insertRes.ok) {
    throw new Error(`Failed to insert market_product_matches: ${insertRes.status} ${await insertRes.text()}`);
  }
}

export async function dedupeProducts(): Promise<void> {
  requireDatabase();

  const [categoryMap, platformSlugs, products] = await Promise.all([
    fetchCategoryMap(),
    fetchPlatformSlugs(),
    fetchActiveProducts(),
  ]);

  const buckets = bucketByCanonicalCategory(products, categoryMap, platformSlugs);

  const pairs: MatchPair[] = [];
  const skipped: string[] = [];
  for (const [sellerCategory, bucket] of buckets) {
    if (bucket.length > MAX_BUCKET_SIZE) {
      skipped.push(`${sellerCategory} (${bucket.length} products)`);
      continue;
    }
    const requireBrandMatch = sellerCategory === MOBILE_SELLER_CATEGORY;
    pairs.push(...findMatches(bucket, requireBrandMatch));
  }

  await replaceMatches(pairs);

  console.log(
    JSON.stringify(
      {
        productsConsidered: products.length,
        categoriesBucketed: buckets.size,
        categoriesSkipped: skipped,
        matchesFound: pairs.length,
        matchThreshold: MATCH_THRESHOLD,
      },
      null,
      2,
    ),
  );
}
