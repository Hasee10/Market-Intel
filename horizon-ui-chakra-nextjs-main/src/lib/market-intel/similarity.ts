// Shared token-overlap (Jaccard) title similarity, used by both the
// category-level competitor overlap (competitors.ts) and per-product
// matching (product-matching.ts). MVP-level string comparison, not an
// embeddings-based matcher - see product-matching.ts's header comment for
// why that's deliberately not built yet.
export const STOPWORDS = new Set(['the', 'a', 'an', 'for', 'with', 'and', 'of', 'in', 'pack', 'pcs']);

export const MIN_CONFIDENCE = 0.3;

// Stricter gate for findCompetitorsForProduct (product-matching.ts), which has
// no price bracket anymore - title confidence is the only signal deciding
// inclusion, not just a ranking tiebreak like it is for findTopProductMatches.
// Set lower than MIN_CONFIDENCE on purpose: even a genuine cross-platform,
// cross-brand match (e.g. "Bona Papa Super Diapers" vs "Pampers Baby Dry
// Diapers Size 3") often shares only the category-defining word ("diapers"),
// landing around 0.12-0.15 Jaccard once brand-name tokens are counted in the
// union. 0.2 is high enough to exclude a zero-overlap mismatch (a diaper pack
// vs a toy rattle shares no tokens at all) while leaving room for a real but
// differently-branded/worded match. This is a known ceiling of plain
// word-overlap similarity, not a promise of perfect product-type detection -
// a real fix would need an embeddings/classifier model, deliberately not
// built here (see this file's header comment).
export const MIN_COMPETITOR_CONFIDENCE = 0.2;

// Naive singularization - not a real stemmer, just enough to stop a plain
// plural/singular mismatch from zeroing out a real match now that title
// confidence is a hard filter (MIN_COMPETITOR_CONFIDENCE): a seller titling
// their product "Laptops" tokenized to a completely different word than a
// competitor listing titled "Laptop", so they shared zero tokens and never
// matched despite being the same product. Same MVP-level string-comparison
// philosophy as the rest of this file - a few common-suffix rules, not a
// dictionary or a real stemming library.
function singularize(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return token.slice(0, -3) + 'y';
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

export function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1 && !STOPWORDS.has(token))
      .map(singularize),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
