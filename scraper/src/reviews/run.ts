import { getReviewScrapeBatch, saveProductReviews } from '../db.js';
import { config } from '../config.js';
import { randomDelay } from '../sources/polite.js';
import { scrapePriceoyeProductReviews } from './scrape-priceoye-reviews.js';

// Only PriceOye for now - the one source with a confirmed, reachable review
// data source that works with a plain HTTP fetch (see migrations/031's
// header comment for why Daraz and the Shopify/WooCommerce sources aren't
// included yet). Adding a platform here is additive once its extractor
// exists - the schema and batch-selection query are already generic.
const REVIEW_PLATFORMS = ['priceoye'];

/** Between consecutive product-detail fetches - same shape as PAGE_DELAY_MS in polite.ts, applied here since this job makes a fresh per-product request the listing scrape never did. */
const PRODUCT_DELAY_MS: [number, number] = [1500, 4000];

interface RunSummary {
  productsProcessed: number;
  reviewsSaved: number;
  errors: number;
}

async function run(): Promise<void> {
  const batch = await getReviewScrapeBatch(REVIEW_PLATFORMS, config.reviewScrapeBatchSize);
  console.log(`[reviews] batch size: ${batch.length}`);

  const summary: RunSummary = { productsProcessed: 0, reviewsSaved: 0, errors: 0 };

  for (const product of batch) {
    try {
      const reviews = await scrapePriceoyeProductReviews(product.url);
      await saveProductReviews(product.id, reviews);
      summary.productsProcessed += 1;
      summary.reviewsSaved += reviews.length;
    } catch (err) {
      // Best-effort per product, same resilience convention as every source
      // in sources/*.ts - one product's failure (dead link, transient block)
      // never aborts the rest of the batch. Deliberately does NOT call
      // saveProductReviews on failure, so a failed fetch stays eligible for
      // retry next run instead of being stamped as "done" with zero results.
      console.error(`[reviews] failed for ${product.url}:`, (err as Error).message);
      summary.errors += 1;
    }

    await randomDelay(PRODUCT_DELAY_MS);
  }

  console.log(JSON.stringify(summary, null, 2));

  if (batch.length > 0 && summary.errors === batch.length) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('[reviews] fatal:', err);
  process.exitCode = 1;
});
