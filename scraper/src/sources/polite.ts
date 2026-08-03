// Shared politeness helpers for the sources added in the 2026-08-03 coverage
// expansion (mega, naheed, vmart, shopperspk).
//
// Deliberately a new file rather than an edit to any existing source: the
// original seven each inline their own pacing (or none), and rewriting them to
// share this would be a refactor of working scrapers for no functional gain.
// New sources use this; existing ones are untouched.

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Full browser-ish header set. A bare User-Agent with no Accept/Accept-Language
// is an obvious tell - same reasoning as the note in olx.ts.
export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-PK,en;q=0.9',
};

export const JSON_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/javascript,*/*;q=0.8',
  'Accept-Language': 'en-PK,en;q=0.9',
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Randomised so the interval between requests is not itself a bot signal. */
export function randomDelay([min, max]: [number, number]): Promise<void> {
  return sleep(min + Math.random() * (max - min));
}

/** Between consecutive pages of the same category. */
export const PAGE_DELAY_MS: [number, number] = [1500, 4000];
/** Between different categories, i.e. a natural pause in browsing. */
export const CATEGORY_DELAY_MS: [number, number] = [4000, 9000];

const RETRY_BACKOFFS_MS = [5_000, 15_000, 40_000];

/**
 * Fetch with bounded retries on transient failures (429/5xx/network error).
 * A 404 is not retried - it means the URL is wrong, and retrying it three
 * times just wastes the run's time budget.
 *
 * Throws once the retries are exhausted, so the caller's existing per-category
 * try/catch records the failure without the whole run dying.
 */
export async function politeFetch(
  url: string,
  label: string,
  headers: Record<string, string> = DEFAULT_HEADERS,
): Promise<Response> {
  let lastError = '';

  for (let attempt = 0; ; attempt += 1) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return res;

      // Client errors other than rate-limiting are not transient.
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`${label} failed: ${res.status}`);
      }
      lastError = `status ${res.status}`;
    } catch (err) {
      const message = (err as Error).message;
      // Rethrow the non-transient error raised just above rather than
      // retrying it.
      if (message.includes('failed: ')) throw err;
      lastError = message;
    }

    if (attempt >= RETRY_BACKOFFS_MS.length) {
      throw new Error(`${label} failed after ${attempt + 1} attempts: ${lastError}`);
    }

    const backoff = RETRY_BACKOFFS_MS[attempt];
    console.warn(`[${label}] ${lastError}, retrying in ${backoff / 1000}s (attempt ${attempt + 2})`);
    await sleep(backoff);
  }
}

/** "Rs. 189,999" / "1,25,000" -> 189999. Undefined when there is no number. */
export function parsePriceText(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return undefined;
  const value = Number(digits);
  return Number.isFinite(value) ? value : undefined;
}
