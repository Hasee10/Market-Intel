import { config, requireDatabase } from './config.js';
import type { RawClassifiedListing, RawProduct } from './types.js';

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
 * Upserts products into market_products (by platform_id + external_id) and
 * appends one row per product into market_price_history.
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

    const saved = (await res.json()) as Array<{ id: string; price: number | null; compare_at_price: number | null; in_stock: boolean | null }>;
    const historyRows = saved.map((row) => ({
      product_id: row.id,
      price: row.price,
      compare_at_price: row.compare_at_price,
      in_stock: row.in_stock,
      recorded_at: now,
    }));

    const historyRes = await fetch(`${config.supabaseUrl}/rest/v1/market_price_history`, {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(historyRows),
    });
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
