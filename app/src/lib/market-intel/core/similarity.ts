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

// --- IDF-weighted ranking -------------------------------------------------
//
// Plain jaccard() above weights every token equally, which is the right
// call for deciding *inclusion* but the wrong one for deciding *order*.
// "Samsung Galaxy A15" against "Samsung Galaxy Z Fold 5" shares two of
// three tokens on brand prefix alone and scores 0.5 - comfortably over
// MIN_COMPETITOR_CONFIDENCE - so every phone in a family matched every
// other, at any price. The distinguishing token ("a15") counted for
// exactly as much as "samsung", which nearly every candidate carries.
//
// The fix is additive and deliberately scoped: **plain Jaccard still
// decides what counts as a match.** IDF only re-ranks and bands what
// already qualified. That boundary is not stylistic - for genuinely
// fungible goods the shared category word IS the signal ("Bona Papa Super
// Diapers" vs "Pampers Baby Dry Diapers" overlap only on "diapers"), and
// IDF would down-weight exactly that token and throw the match away. Do
// not move the inclusion gate onto these functions.
//
// No corpus infrastructure: document frequency is computed per request
// over the candidate pool already in memory. That is also the *correct*
// corpus for this question - within a pool of candidates fetched for a
// Samsung product, "samsung" genuinely does not discriminate, and its low
// weight here is a fact about this comparison rather than about English.

/**
 * Smoothed IDF over already-tokenized titles. Smoothing (+1 both terms,
 * +1 to the result) keeps every weight positive, so a token appearing in
 * every document is merely uninformative rather than worthless - which
 * matters because with a single-candidate pool every token has df == n and
 * an unsmoothed idf of 0 would make every score 0/0.
 */
export function buildIdf(documents: Set<string>[]): Map<string, number> {
  const documentFrequency = new Map<string, number>();
  for (const tokens of documents) {
    for (const token of tokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const total = documents.length;
  const idf = new Map<string, number>();
  for (const [token, frequency] of documentFrequency) {
    idf.set(token, Math.log((total + 1) / (frequency + 1)) + 1);
  }
  return idf;
}

// A token absent from the corpus is maximally distinctive by definition,
// but scoring it that way would let a typo dominate. Weighting it the same
// as a token in every document is the conservative choice.
const UNKNOWN_TOKEN_WEIGHT = 1;

/**
 * Cosine similarity between the two titles as binary TF-IDF vectors.
 *
 * Cosine rather than an IDF-weighted Jaccard, and the difference is not
 * cosmetic - it is the whole fix. Weighted Jaccard sums weights linearly,
 * so two low-information tokens still out-total one high-information one:
 * for "Samsung Galaxy A15" against "Samsung Galaxy S23" in a pool of
 * Samsung phones, samsung + galaxy summed to 2.21 against a15's 2.20 and
 * the wrong listing still won by a hair. Cosine squares the weights, so a
 * single rare shared token genuinely dominates several ubiquitous ones -
 * the same pair scores 0.53 for the real model match against 0.30 for the
 * brand-prefix one.
 *
 * Length normalisation comes free with cosine and is worth having: it
 * stops a long bundle listing ("... Case Cover Screen Protector ...") from
 * scoring highly just because it happens to contain the seller's tokens
 * among many others.
 *
 * Identical titles score exactly 1, since numerator and denominator are
 * then the same sum of squares.
 */
export function idfCosine(a: Set<string>, b: Set<string>, idf: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;

  const weightOf = (token: string) => idf.get(token) ?? UNKNOWN_TOKEN_WEIGHT;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const token of a) {
    const weight = weightOf(token);
    normA += weight * weight;
    if (b.has(token)) dot += weight * weight;
  }
  for (const token of b) {
    const weight = weightOf(token);
    normB += weight * weight;
  }

  if (normA === 0 || normB === 0) return 0;
  // Clamped because the two square roots round independently: identical
  // titles come out at 1.0000000000000002, and this function's contract
  // (and matchStrength's bands) assume 0..1.
  return Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB)));
}

export type MatchStrength = 'strong' | 'likely' | 'loose';

// Cut points on the idfCosine scale, where an identical title is 1.
// **These are initial values, not calibrated against labelled data** - they
// are set so that an exact or near-exact title reads "strong" and a match
// carrying only a shared brand prefix reads "loose", which is the failure
// this banding exists to make visible. For reference, the worked example in
// idfCosine's comment lands the real model match at ~0.53 and the
// brand-prefix one at ~0.30. Revisit against real listings before treating
// these as meaningful thresholds; they are exported so that happens in one
// place.
export const STRONG_MATCH_RELEVANCE = 0.6;
export const LIKELY_MATCH_RELEVANCE = 0.35;

export function matchStrength(relevance: number): MatchStrength {
  if (relevance >= STRONG_MATCH_RELEVANCE) return 'strong';
  if (relevance >= LIKELY_MATCH_RELEVANCE) return 'likely';
  return 'loose';
}
