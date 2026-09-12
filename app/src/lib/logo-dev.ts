'server-only';

const LOGO_DEV_SEARCH_URL = 'https://api.logo.dev/search';

// Resolves a scraped brand name (e.g. "Samsung") to a domain via logo.dev's
// Brand Search API (https://www.logo.dev/docs/brand-search/introduction), so
// showcase.ts can render a real logo.dev image for brand entries instead of
// just an initials fallback. Uses LOGO_DEV_SECRET_KEY - the same key added
// alongside the publishable token for the marketplace slider but never
// actually called until now.
//
// strategy=match ranks exact name matches first (the default, "suggest",
// favors autocomplete-style prefix matches for a typeahead UI, which isn't
// what a one-shot lookup like this wants).
export async function searchBrandDomain(name: string): Promise<string | null> {
  const secretKey = process.env.LOGO_DEV_SECRET_KEY;
  if (!secretKey || !name.trim()) return null;

  try {
    const response = await fetch(
      `${LOGO_DEV_SEARCH_URL}?q=${encodeURIComponent(name)}&strategy=match`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    if (!response.ok) return null;

    const results = (await response.json()) as { name: string; domain: string }[];
    return results[0]?.domain ?? null;
  } catch {
    // Network error, rate limit, malformed response, etc. - the caller
    // already treats a missing domain as "show the initials fallback", so
    // this never needs to surface as an error.
    return null;
  }
}
