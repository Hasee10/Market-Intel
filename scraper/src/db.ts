import { config, requireDatabase } from './config.js';
import type { RawClassifiedListing, RawProduct, RawReview } from './types.js';

const UPSERT_BATCH_SIZE = 200;

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: config.supabaseServiceRoleKey,
    Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function getPlatformId(platformSlug: string): Promise<string> {
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/market_platforms?slug=eq.${platformSlug}&select=id`,
    { headers: headers() },
  );
  if (!res.ok) {
    throw new Error(`Failed to look up platform "${platformSlug}": ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ id: string }>;
  if (!rows.length) {
    throw new Error(`Unknown platform slug "${platformSlug}" - has migrations/001_create_market_tables.sql been applied?`);
  }
  return rows[0].id;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Persists one row per platform per run to scraper_runs - backs the
 * internal scraper health dashboard (Phase 6: iShopping/Goto already have
 * Cloudflare/TLS friction, this is what lets that be tracked over time
 * instead of only visible in a single GitHub Actions log). Best-effort:
 * a failure here shouldn't fail the whole scrape run over telemetry.
 */
export async function saveScrapeRunSummary(
  platformSlug: string,
  productCount: number,
  error?: string,
): Promise<void> {
  try {
    requireDatabase();
    const res = await fetch(`${config.supabaseUrl}/rest/v1/scraper_runs`, {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify([
        { platform_slug: platformSlug, product_count: productCount, error: error ?? null },
      ]),
    });
    if (!res.ok) {
      console.error(`[db] failed to record scraper_runs for "${platformSlug}": ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[db] failed to record scraper_runs for "${platformSlug}":`, (err as Error).message);
  }
}

/**
 * Position of each product on its category page, keyed by external_id.
 *
 * Every source walks category pages in order and pushes products in that
 * order (verified across all 17 sources on 2026-09-18: none sorts, none
 * fetches pages in parallel), so array index within a category IS the
 * page position. Counted per category because one source's array carries
 * several categories back to back. Exported for testing; pure.
 *
 * `products` must already be deduped by external_id - a product listed in
 * two categories keeps the position from the first one seen, which is also
 * the category_slug saveProducts stores for it.
 */
export function assignRanks(products: RawProduct[]): Map<string, number> {
  const ranks = new Map<string, number>();
  const counters = new Map<string, number>();
  for (const p of products) {
    const key = p.categorySlug ?? '';
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    ranks.set(p.externalId, next);
  }
  return ranks;
}

/**
 * Upserts products into market_products (by platform_id + external_id) and
 * appends one row per product into market_price_history, each carrying the
 * product's position on its category page (migration 060).
 */
export async function saveProducts(platformSlug: string, products: RawProduct[]): Promise<void> {
  requireDatabase();
  if (!products.length) return;

  const platformId = await getPlatformId(platformSlug);
  // Captured before any upsert - anything with last_seen_at still older than
  // this once the run finishes wasn't touched, i.e. it fell out of the
  // categories we just scraped (sold out / delisted / moved).
  const runStartedAt = new Date().toISOString();

  const dedupedByKey = new Map<string, RawProduct>();
  for (const p of products) {
    dedupedByKey.set(p.externalId, p);
  }
  const deduped = [...dedupedByKey.values()];
  const categorySlugs = [...new Set(deduped.map((p) => p.categorySlug).filter((c): c is string => Boolean(c)))];
  const ranks = assignRanks(deduped);

  for (const batch of chunk(deduped, UPSERT_BATCH_SIZE)) {
    const now = new Date().toISOString();
    const rows = batch.map((p) => ({
      platform_id: platformId,
      external_id: p.externalId,
      category_slug: p.categorySlug ?? null,
      title: p.title,
      brand: p.brand ?? null,
      url: p.url,
      image_url: p.imageUrl ?? null,
      gallery_urls: p.galleryUrls ?? null,
      currency: p.currency ?? 'PKR',
      price: p.price ?? null,
      compare_at_price: p.compareAtPrice ?? null,
      in_stock: p.inStock ?? null,
      rating: p.rating ?? null,
      rating_count: p.ratingCount ?? null,
      // Null for every single-retailer source - only true marketplaces name
      // the merchant behind a listing (see migrations/019).
      seller_name: p.sellerName ?? null,
      seller_external_id: p.sellerExternalId ?? null,
      sold_count: p.soldCount ?? null,
      is_active: true,
      last_seen_at: now,
    }));

    const res = await fetch(`${config.supabaseUrl}/rest/v1/market_products?on_conflict=platform_id,external_id`, {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      throw new Error(`market_products upsert failed: ${res.status} ${await res.text()}`);
    }

    const saved = (await res.json()) as Array<{
      id: string;
      external_id: string;
      price: number | null;
      compare_at_price: number | null;
      in_stock: boolean | null;
    }>;
    // Rank is looked up by external_id, never by array position: PostgREST
    // returns the upserted representation, and nothing guarantees it comes
    // back in the order the batch was sent.
    const historyRows = saved.map((row) => ({
      product_id: row.id,
      price: row.price,
      compare_at_price: row.compare_at_price,
      in_stock: row.in_stock,
      rank: ranks.get(row.external_id) ?? null,
      recorded_at: now,
    }));

    // on_conflict + ignore-duplicates against the (product_id, recorded_date)
    // unique index (migration 026): a retried batch, or two runs landing on
    // the same calendar day, becomes a safe no-op instead of a duplicate row
    // that would double-weight that day's median in market_scope_price_trend.
    const historyRes = await fetch(
      `${config.supabaseUrl}/rest/v1/market_price_history?on_conflict=product_id,recorded_date`,
      {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=ignore-duplicates,return=minimal' }),
        body: JSON.stringify(historyRows),
      },
    );
    if (!historyRes.ok) {
      throw new Error(`market_price_history insert failed: ${historyRes.status} ${await historyRes.text()}`);
    }
  }

  await markStaleProducts(platformId, categorySlugs, runStartedAt);
}

/**
 * Flips is_active to false for any previously-active product in a category
 * we just scraped, but that didn't show up in this run's results - it fell
 * out of the listing (sold out, delisted, or moved categories). Scoped to
 * categorySlugs so we never touch products in categories this run didn't
 * cover (e.g. a category config change, or a category that errored and
 * produced zero results - see safeRun in pipeline.ts).
 */
async function markStaleProducts(platformId: string, categorySlugs: string[], runStartedAt: string): Promise<void> {
  if (!categorySlugs.length) return;

  const categoryFilter = categorySlugs.map((c) => encodeURIComponent(c)).join(',');
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/market_products?platform_id=eq.${platformId}&category_slug=in.(${categoryFilter})&last_seen_at=lt.${encodeURIComponent(runStartedAt)}&is_active=eq.true`,
    {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ is_active: false }),
    },
  );
  if (!res.ok) {
    throw new Error(`market_products stale-marking failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Fetches up to `limit` active products for the given platform slugs whose
 * reviews haven't been scraped, or were scraped more than `cooldownDays`
 * ago - oldest/never-scraped first, so coverage builds up across runs
 * instead of the same head-of-catalog products being reprocessed forever.
 * This is the single knob (config.reviewScrapeBatchSize) that keeps any one
 * run's added request volume bounded - see config.ts's comment.
 */
export async function getReviewScrapeBatch(
  platformSlugs: string[],
  limit: number,
  cooldownDays = 14,
): Promise<Array<{ id: string; url: string }>> {
  requireDatabase();
  const platformIds = await Promise.all(platformSlugs.map(getPlatformId));
  const cutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000).toISOString();

  const platformFilter = platformIds.map((id) => encodeURIComponent(id)).join(',');
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/market_products` +
      `?platform_id=in.(${platformFilter})` +
      `&is_active=eq.true` +
      `&or=(reviews_scraped_at.is.null,reviews_scraped_at.lt.${encodeURIComponent(cutoff)})` +
      `&order=reviews_scraped_at.asc.nullsfirst` +
      `&limit=${limit}&select=id,url`,
    { headers: headers() },
  );
  if (!res.ok) {
    throw new Error(`Failed to load review-scrape batch: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Array<{ id: string; url: string }>;
}

/**
 * Upserts reviews for one product and stamps reviews_scraped_at - called
 * even when `reviews` is empty, so a product with genuinely zero reviews
 * doesn't get retried every run within the cooldown window.
 */
export async function saveProductReviews(productId: string, reviews: RawReview[]): Promise<void> {
  requireDatabase();

  if (reviews.length > 0) {
    const rows = reviews.map((r) => ({
      product_id: productId,
      author: r.author ?? null,
      rating: r.rating ?? null,
      review_text: r.text,
      reviewed_at: r.reviewedAt ?? null,
    }));
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/market_product_reviews?on_conflict=product_id,author,review_text`,
      {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=ignore-duplicates,return=minimal' }),
        body: JSON.stringify(rows),
      },
    );
    if (!res.ok) {
      throw new Error(`market_product_reviews upsert failed: ${res.status} ${await res.text()}`);
    }
  }

  const stampRes = await fetch(`${config.supabaseUrl}/rest/v1/market_products?id=eq.${productId}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ reviews_scraped_at: new Date().toISOString() }),
  });
  if (!stampRes.ok) {
    throw new Error(`market_products reviews_scraped_at stamp failed: ${stampRes.status} ${await stampRes.text()}`);
  }
}

/**
 * Rebuilds market_competitors from the seller identity carried on
 * market_products (ROADMAP.md C1, migration 022). Runs once at the end of a
 * scrape rather than per source, because the entity is keyed on
 * (platform, seller) across every category a seller appears in.
 *
 * Best-effort, like saveScrapeRunSummary: the competitor table is derived
 * data, and failing the whole run because a rollup did not refresh would lose
 * the scraped products too. Requires migration 022; until it is applied this
 * logs a 404 once per run and nothing else breaks.
 */
export async function refreshCompetitors(): Promise<void> {
  try {
    requireDatabase();
    const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/market_refresh_competitors`, {
      method: 'POST',
      headers: headers(),
      body: '{}',
    });
    if (!res.ok) {
      console.error(`[db] market_refresh_competitors failed: ${res.status} ${await res.text()}`);
      return;
    }
    console.log(`[db] competitors refreshed: ${await res.text()} rows`);
  } catch (err) {
    console.error('[db] market_refresh_competitors failed:', (err as Error).message);
  }
}

/**
 * Upserts listings into market_classified_listings (by platform_id +
 * external_id) and appends one row per listing into
 * market_classified_price_history. See migrations/007 for why classifieds
 * get their own tables instead of market_products/market_price_history.
 */
export async function saveClassifiedListings(
  platformSlug: string,
  listings: RawClassifiedListing[],
): Promise<void> {
  requireDatabase();
  if (!listings.length) return;

  const platformId = await getPlatformId(platformSlug);
  // See saveProducts' runStartedAt comment - same staleness technique.
  const runStartedAt = new Date().toISOString();

  const dedupedByKey = new Map<string, RawClassifiedListing>();
  for (const l of listings) {
    dedupedByKey.set(l.externalId, l);
  }
  const deduped = [...dedupedByKey.values()];
  const categorySlugs = [...new Set(deduped.map((l) => l.categorySlug).filter((c): c is string => Boolean(c)))];

  for (const batch of chunk(deduped, UPSERT_BATCH_SIZE)) {
    const now = new Date().toISOString();
    const rows = batch.map((l) => ({
      platform_id: platformId,
      external_id: l.externalId,
      category_slug: l.categorySlug ?? null,
      title: l.title,
      url: l.url,
      image_url: l.imageUrl ?? null,
      currency: l.currency ?? 'PKR',
      price: l.price ?? null,
      condition: l.condition ?? null,
      city: l.city ?? null,
      seller_type: l.sellerType ?? null,
      posted_at: l.postedAt ?? null,
      status: 'active',
      last_seen_at: now,
    }));

    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/market_classified_listings?on_conflict=platform_id,external_id`,
      {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(rows),
      },
    );
    if (!res.ok) {
      throw new Error(`market_classified_listings upsert failed: ${res.status} ${await res.text()}`);
    }

    const saved = (await res.json()) as Array<{ id: string; price: number | null }>;
    const historyRows = saved.map((row) => ({
      listing_id: row.id,
      price: row.price,
      status: 'active',
      recorded_at: now,
    }));

    const historyRes = await fetch(`${config.supabaseUrl}/rest/v1/market_classified_price_history`, {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(historyRows),
    });
    if (!historyRes.ok) {
      throw new Error(
        `market_classified_price_history insert failed: ${historyRes.status} ${await historyRes.text()}`,
      );
    }
  }

  await markStaleClassifiedListings(platformId, categorySlugs, runStartedAt);
}

/**
 * Same idea as markStaleProducts - flips status to 'inactive' for listings
 * in a scraped category that weren't seen this run (sold, taken down, or
 * expired off OLX).
 */
async function markStaleClassifiedListings(
  platformId: string,
  categorySlugs: string[],
  runStartedAt: string,
): Promise<void> {
  if (!categorySlugs.length) return;

  const categoryFilter = categorySlugs.map((c) => encodeURIComponent(c)).join(',');
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/market_classified_listings?platform_id=eq.${platformId}&category_slug=in.(${categoryFilter})&last_seen_at=lt.${encodeURIComponent(runStartedAt)}&status=eq.active`,
    {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ status: 'inactive' }),
    },
  );
  if (!res.ok) {
    throw new Error(`market_classified_listings stale-marking failed: ${res.status} ${await res.text()}`);
  }
}
