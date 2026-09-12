import 'server-only';

// In-memory fixed-window limiter, keyed by caller IP. Deliberately not the
// fix for finding #7 in SECURITY.md (auth endpoints need a shared store like
// Upstash/Redis, since a Vercel serverless deployment runs many instances
// that don't share this Map) - this is a much smaller bar: slow down casual
// abuse of a single public, non-auth route without adding an external
// dependency for it. A cold start or a request landing on a different
// instance resets the count to zero, so treat this as "raises the cost of
// hammering the route," not a hard guarantee.
const WINDOW_MS = 60_000;
const MAX_ENTRIES = 5_000; // bound worst-case memory if this ever gets hammered from many IPs

const hits = new Map<string, { count: number; resetAt: number }>();

function prune(now: number) {
  if (hits.size < MAX_ENTRIES) return;
  for (const [key, entry] of hits) {
    if (entry.resetAt <= now) hits.delete(key);
  }
  // Still over budget after pruning expired entries: drop the oldest
  // (Map preserves insertion order) rather than let it grow unbounded.
  if (hits.size >= MAX_ENTRIES) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }
}

export function isRateLimited(key: string, limit: number, windowMs = WINDOW_MS): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    prune(now);
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > limit;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
