// Normalizes a user-supplied website into a bare domain suitable for
// logo.dev's img.logo.dev/<domain> lookup (it wants "yourstore.pk", not
// "https://www.yourstore.pk/some/path?utm=..."). Shared by the settings
// "website" field (api/profile route) and anywhere else a seller-entered
// URL needs to become a lookup key.
//
// Returns null for anything that isn't plausibly a domain, so callers can
// reject bad input instead of silently storing garbage that would just
// fail every logo.dev request later.
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

export function sanitizeDomain(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let host: string;
  try {
    // new URL() requires a scheme; add one if the user typed a bare domain.
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    host = new URL(withScheme).hostname;
  } catch {
    return null;
  }

  const domain = host.toLowerCase().replace(/^www\./, '');
  return DOMAIN_RE.test(domain) ? domain : null;
}
