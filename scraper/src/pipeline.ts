import { refreshCompetitors, saveClassifiedListings, saveProducts, saveScrapeRunSummary } from './db.js';
import { dedupeProducts } from './dedupe.js';
import { BROWSER_SOURCES, CLASSIFIED_SOURCES, HTTP_SOURCES } from './sources/index.js';
import { isCircuitOpen, resetCircuitBreaker } from './sources/polite.js';
import type { ClassifiedSourceFn, ClassifiedSourceResult, SourceFn, SourceResult } from './types.js';

interface SourceRunSummary {
  platformSlug: string;
  productCount: number;
  error?: string;
}

// A source that returns an empty array without throwing looks identical in
// telemetry to a source that legitimately found nothing - which is how OLX sat
// at `product_count: 0, error: null` across three runs while it was in fact
// failing on every category. No configured source should ever legitimately
// return zero, so record the emptiness itself as the error.
const ZERO_RESULT_ERROR =
  'returned 0 rows without throwing - source is configured with categories, so this is a silent failure, not an empty market';

async function safeRun(source: SourceFn): Promise<SourceRunSummary> {
  try {
    const result: SourceResult = await source();
    await saveProducts(result.platformSlug, result.products);
    const empty = result.products.length === 0;
    await saveScrapeRunSummary(result.platformSlug, result.products.length, empty ? ZERO_RESULT_ERROR : undefined);
    if (empty) console.warn(`[pipeline] ${result.platformSlug} ${ZERO_RESULT_ERROR}`);
    return { platformSlug: result.platformSlug, productCount: result.products.length };
  } catch (err) {
    const message = (err as Error).message;
    console.error('[pipeline] source failed:', message);
    await saveScrapeRunSummary(source.name, 0, message);
    return { platformSlug: source.name, productCount: 0, error: message };
  }
}

async function safeRunClassified(source: ClassifiedSourceFn): Promise<SourceRunSummary> {
  try {
    const result: ClassifiedSourceResult = await source();
    await saveClassifiedListings(result.platformSlug, result.listings);
    const empty = result.listings.length === 0;
    await saveScrapeRunSummary(result.platformSlug, result.listings.length, empty ? ZERO_RESULT_ERROR : undefined);
    if (empty) console.warn(`[pipeline] ${result.platformSlug} ${ZERO_RESULT_ERROR}`);
    return { platformSlug: result.platformSlug, productCount: result.listings.length };
  } catch (err) {
    const message = (err as Error).message;
    console.error('[pipeline] classified source failed:', message);
    await saveScrapeRunSummary(source.name, 0, message);
    return { platformSlug: source.name, productCount: 0, error: message };
  }
}

export async function run(): Promise<void> {
  const summaries: SourceRunSummary[] = [];

  // Sources whose circuit breaker tripped, kept for one more attempt below.
  const trippedSources: { index: number; source: SourceFn }[] = [];
  for (const source of HTTP_SOURCES) {
    const summary = await safeRun(source);
    if (isCircuitOpen(summary.platformSlug)) trippedSources.push({ index: summaries.length, source });
    summaries.push(summary);
  }

  // Second pass for anything the breaker abandoned. The 2026-09-20 run lost
  // eight Shopify sources to a ten-minute IP throttle at Shopify's edge; the
  // run itself took over an hour, so by the time the last source finished
  // the throttle was long gone. One more attempt, same code path, and the
  // summary row is replaced so telemetry shows what the run actually got.
  // Only sources that tripped the breaker qualify - a source that simply
  // returned nothing, or failed for a non-transient reason, is not retried.
  if (trippedSources.length > 0) {
    console.warn(`[pipeline] retrying ${trippedSources.length} source(s) whose circuit breaker tripped: ${trippedSources.map((t) => summaries[t.index].platformSlug).join(', ')}`);
    for (const { index, source } of trippedSources) {
      resetCircuitBreaker(summaries[index].platformSlug);
      summaries[index] = await safeRun(source);
    }
  }

  for (const source of BROWSER_SOURCES) {
    summaries.push(await safeRun(source));
  }
  for (const source of CLASSIFIED_SOURCES) {
    summaries.push(await safeRunClassified(source));
  }

  // After every source, not per source: a competitor is keyed on
  // (platform, seller) across all their categories (ROADMAP.md C1).
  await refreshCompetitors();

  // Cross-source duplicate detection (see dedupe.ts) - a secondary analytics
  // pass over already-saved data, not core data collection, so a failure
  // here logs loudly but doesn't fail the whole scrape run's exit code.
  try {
    await dedupeProducts();
  } catch (err) {
    console.error('[pipeline] dedupeProducts failed:', (err as Error).message);
  }

  const zeroResult = summaries.filter((s) => !s.error && s.productCount === 0);
  const errored = summaries.filter((s) => s.error);

  console.log(JSON.stringify({ summaries, zeroResultCount: zeroResult.length, erroredCount: errored.length }, null, 2));

  if (errored.length === summaries.length && summaries.length > 0) {
    process.exitCode = 1;
  }
}
