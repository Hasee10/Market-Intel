// Standalone entry point (run separately from the main scrape pipeline, see
// npm run match-products) that recomputes cross-platform mobile matches and
// replaces the stored set. Catalog structure changes far less often than
// price, so this doesn't need to run on the same 2-day cadence as run.ts.
import { config, requireDatabase } from './config.js';
import { findMatches, MOBILE_CATEGORY_SLUGS, type MatchableProduct } from './matching.js';

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: config.supabaseServiceRoleKey,
    Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function fetchMobileProducts(): Promise<MatchableProduct[]> {
  const platformsRes = await fetch(
    `${config.supabaseUrl}/rest/v1/market_platforms?slug=in.(${Object.keys(MOBILE_CATEGORY_SLUGS).join(',')})&select=id,slug`,
    { headers: headers() },
  );
  if (!platformsRes.ok) {
    throw new Error(`Failed to load platforms: ${platformsRes.status} ${await platformsRes.text()}`);
  }
  const platforms = (await platformsRes.json()) as Array<{ id: string; slug: string }>;

  const products: MatchableProduct[] = [];
  for (const platform of platforms) {
    const slugs = MOBILE_CATEGORY_SLUGS[platform.slug];
    const categoryFilter = slugs.map((s) => encodeURIComponent(s)).join(',');
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/market_products?platform_id=eq.${platform.id}&category_slug=in.(${categoryFilter})&is_active=eq.true&price=not.is.null&select=id,title,price`,
      { headers: headers() },
    );
    if (!res.ok) {
      throw new Error(`Failed to load products for ${platform.slug}: ${res.status} ${await res.text()}`);
    }
    const rows = (await res.json()) as Array<{ id: string; title: string; price: number }>;
    for (const row of rows) {
      products.push({ id: row.id, platformSlug: platform.slug, title: row.title, price: row.price });
    }
  }
  return products;
}

async function replaceMatches(pairs: Array<{ productAId: string; productBId: string; confidence: number }>) {
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

async function main() {
  requireDatabase();
  const products = await fetchMobileProducts();
  const pairs = findMatches(products);
  await replaceMatches(pairs);
  console.log(JSON.stringify({ productsConsidered: products.length, matchesFound: pairs.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
