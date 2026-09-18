// Cross-site request check for cookie-authenticated API mutations.
//
// leaks.md finding #11 (Info): the JSON routes under /api/* authenticate by
// session cookie, and nothing verified that a state-changing request came
// from this site. In practice two things already stood in the way - the
// session cookie is SameSite=Lax (a browser will not attach it to a
// cross-site POST) and a cross-site fetch with a JSON content-type triggers
// a CORS preflight the server never approves. But both are defaults doing
// the work by accident: a <form enctype="text/plain"> body can be shaped to
// look like JSON and request.json() parses body text without checking the
// content-type, so the cookie's SameSite attribute was the only real guard.
// This makes the rule explicit.
//
// The check uses Fetch Metadata (Sec-Fetch-Site), which every current
// browser sends and which cannot be set by page script, falling back to
// the Origin header for browsers that predate it. Same-origin and
// same-site requests pass; "none" passes too - that is a user-initiated
// navigation (typed URL, bookmark), not a cross-site page. Anything else
// is refused.
//
// It applies only where a cookie could be the credential. A request that
// carries `Authorization: Bearer` is the mobile app or the cron workflow:
// neither has a cookie to forge, a native client sends no Origin at all,
// and refusing them here would break both for no gain. A request with
// neither fetch metadata nor an Origin is a non-browser client (curl, a
// script) and cannot be a CSRF vector, so it passes.

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ALLOWED_SITE = new Set(['same-origin', 'same-site', 'none']);

export type CsrfVerdict = { blocked: false } | { blocked: true; reason: string };

export function checkCrossSite(request: {
  method: string;
  headers: { get(name: string): string | null };
  nextUrl?: { host: string };
  url?: string;
}): CsrfVerdict {
  if (!MUTATING.has(request.method.toUpperCase())) return { blocked: false };

  const auth = request.headers.get('authorization');
  if (auth && /^bearer\s+\S/i.test(auth)) return { blocked: false };

  const site = request.headers.get('sec-fetch-site');
  if (site) {
    return ALLOWED_SITE.has(site.toLowerCase())
      ? { blocked: false }
      : { blocked: true, reason: `Sec-Fetch-Site: ${site}` };
  }

  const origin = request.headers.get('origin');
  if (origin) {
    const host = request.nextUrl?.host ?? safeHost(request.url);
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      return { blocked: true, reason: `unparseable Origin: ${origin}` };
    }
    return host && originHost === host
      ? { blocked: false }
      : { blocked: true, reason: `Origin ${origin} does not match ${host ?? 'request host'}` };
  }

  return { blocked: false };
}

function safeHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
