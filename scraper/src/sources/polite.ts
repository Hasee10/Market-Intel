// Shared politeness helpers for the sources added in the 2026-08-03 coverage
// expansion (mega, naheed, vmart, shopperspk).
//
// Deliberately a new file rather than an edit to any existing source: the
// original seven each inline their own pacing (or none), and rewriting them to
// share this would be a refactor of working scrapers for no functional gain.
// New sources use this; existing ones are untouched - if one of them starts
// showing a 429 pattern in scraper_runs the way OLX did, that's the trigger
// to retrofit it with these helpers, not a preemptive rewrite (see mind.md).

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

const RETRY_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;
const MAX_RETRY_AFTER_MS = 120_000; // don't let a hostile/broken Retry-After value stall a run indefinitely

/** Full jitter (AWS's recommended strategy): random(0, min(max, base * 2^attempt)) - spreads retries out instead of every failed request waking up in lockstep. */
function exponentialBackoffWithJitter(attempt: number): number {
  const cap = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  return Math.random() * cap;
}

/** Parses a Retry-After header - either delta-seconds (the common case here) or an HTTP-date. Returns null if absent/unparseable. */
function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? Math.min(delta, MAX_RETRY_AFTER_MS) : 0;
  }
  return null;
}

export class CircuitOpenError extends Error {
  constructor(platformKey: string) {
    super(`[${platformKey}] circuit open - too many consecutive failures this run, skipping remaining requests`);
    this.name = 'CircuitOpenError';
  }
}

const CIRCUIT_BREAKER_THRESHOLD = 3; // consecutive politeFetch() calls (each already internally retried) that must fail
const consecutiveFailuresByPlatform = new Map<string, number>();

/** Call once per scraper run (or per source module load) if a stale in-process count from a prior run could otherwise linger - not required for the GitHub Actions cron, where every run is a fresh process, but cheap insurance for local/long-lived runs. */
export function resetCircuitBreaker(platformKey: string): void {
  consecutiveFailuresByPlatform.delete(platformKey);
}

/**
 * Fetch with bounded retries on transient failures (429/5xx/network error),
 * exponential backoff with jitter, and Retry-After header respect when the
 * server sends one. A 404 is not retried - it means the URL is wrong, and
 * retrying it three times just wastes the run's time budget.
 *
 * When `platformKey` is given, tracks consecutive whole-call failures across
 * every politeFetch() call sharing that key (i.e. across categories/pages
 * within one platform's run, not just within one call's own retry loop). If
 * CIRCUIT_BREAKER_THRESHOLD consecutive calls all exhaust their retries, the
 * *next* call throws CircuitOpenError immediately without attempting a
 * fetch - the platform is genuinely blocking this run, and continuing to
 * hammer its remaining categories one by one wastes time and looks worse to
 * whatever's rate-limiting us. The caller's per-category loop should let
 * CircuitOpenError propagate out rather than catching-and-continuing.
 *
 * Throws once retries (or the circuit) are exhausted, so the caller's
 * existing per-category try/catch records the failure without the whole
 * run dying.
 */
export async function politeFetch(
  url: string,
  label: string,
  headers: Record<string, string> = DEFAULT_HEADERS,
  platformKey?: string,
): Promise<Response> {
  if (platformKey && (consecutiveFailuresByPlatform.get(platformKey) ?? 0) >= CIRCUIT_BREAKER_THRESHOLD) {
    throw new CircuitOpenError(platformKey);
  }

  let lastError = '';

  for (let attempt = 0; ; attempt += 1) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        if (platformKey) consecutiveFailuresByPlatform.set(platformKey, 0);
        return res;
      }

      // Client errors other than rate-limiting are not transient.
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`${label} failed: ${res.status}`);
      }
      lastError = `status ${res.status}`;

      if (attempt >= RETRY_ATTEMPTS) {
        if (platformKey) {
          consecutiveFailuresByPlatform.set(platformKey, (consecutiveFailuresByPlatform.get(platformKey) ?? 0) + 1);
        }
        throw new Error(`${label} failed after ${attempt + 1} attempts: ${lastError}`);
      }

      const retryAfterMs = res.status === 429 ? parseRetryAfterMs(res.headers.get('retry-after')) : null;
      const backoff = retryAfterMs ?? exponentialBackoffWithJitter(attempt);
      console.warn(
        `[${label}] ${lastError}, retrying in ${(backoff / 1000).toFixed(1)}s (attempt ${attempt + 2})${retryAfterMs != null ? ' [Retry-After]' : ''}`,
      );
      await sleep(backoff);
    } catch (err) {
      const message = (err as Error).message;
      // Rethrow the non-transient/exhausted-retries error raised just above
      // rather than retrying it again.
      if (message.includes('failed: ') || message.includes('failed after')) throw err;
      lastError = message;

      if (attempt >= RETRY_ATTEMPTS) {
        if (platformKey) {
          consecutiveFailuresByPlatform.set(platformKey, (consecutiveFailuresByPlatform.get(platformKey) ?? 0) + 1);
        }
        throw new Error(`${label} failed after ${attempt + 1} attempts: ${lastError}`);
      }

      const backoff = exponentialBackoffWithJitter(attempt);
      console.warn(`[${label}] ${lastError}, retrying in ${(backoff / 1000).toFixed(1)}s (attempt ${attempt + 2})`);
      await sleep(backoff);
    }
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
