// Shared token-overlap (Jaccard) title similarity, used by both the
// category-level competitor overlap (competitors.ts) and per-product
// matching (product-matching.ts). MVP-level string comparison, not an
// embeddings-based matcher - see product-matching.ts's header comment for
// why that's deliberately not built yet.
export const STOPWORDS = new Set(['the', 'a', 'an', 'for', 'with', 'and', 'of', 'in', 'pack', 'pcs']);

export const MIN_CONFIDENCE = 0.3;

export function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1 && !STOPWORDS.has(token)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
