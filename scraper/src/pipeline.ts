import { saveClassifiedListings, saveProducts } from './db.js';
import { BROWSER_SOURCES, CLASSIFIED_SOURCES, HTTP_SOURCES } from './sources/index.js';
import type { ClassifiedSourceFn, ClassifiedSourceResult, SourceFn, SourceResult } from './types.js';

interface SourceRunSummary {
  platformSlug: string;
  productCount: number;
  error?: string;
}

async function safeRun(source: SourceFn): Promise<SourceRunSummary> {
  try {
    const result: SourceResult = await source();
    await saveProducts(result.platformSlug, result.products);
    return { platformSlug: result.platformSlug, productCount: result.products.length };
  } catch (err) {
    const message = (err as Error).message;
    console.error('[pipeline] source failed:', message);
    return { platformSlug: source.name, productCount: 0, error: message };
  }
}

async function safeRunClassified(source: ClassifiedSourceFn): Promise<SourceRunSummary> {
  try {
    const result: ClassifiedSourceResult = await source();
    await saveClassifiedListings(result.platformSlug, result.listings);
    return { platformSlug: result.platformSlug, productCount: result.listings.length };
  } catch (err) {
    const message = (err as Error).message;
    console.error('[pipeline] classified source failed:', message);
    return { platformSlug: source.name, productCount: 0, error: message };
  }
}

export async function run(): Promise<void> {
  const summaries: SourceRunSummary[] = [];

  for (const source of HTTP_SOURCES) {
    summaries.push(await safeRun(source));
  }
  for (const source of BROWSER_SOURCES) {
    summaries.push(await safeRun(source));
  }
  for (const source of CLASSIFIED_SOURCES) {
    summaries.push(await safeRunClassified(source));
  }

  const zeroResult = summaries.filter((s) => !s.error && s.productCount === 0);
  const errored = summaries.filter((s) => s.error);

  console.log(JSON.stringify({ summaries, zeroResultCount: zeroResult.length, erroredCount: errored.length }, null, 2));

  if (errored.length === summaries.length && summaries.length > 0) {
    process.exitCode = 1;
  }
}
