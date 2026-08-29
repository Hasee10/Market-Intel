// Cross-platform product matching (see migrations/009), generalized 2026-08-29
// to run across every canonical category, not just mobiles.
//
// The original mobiles-only version was validated against live data before
// shipping (throwaway script, ~1,850 products): at confidence >=
// MATCH_THRESHOLD, mobile-category matches were clean across every pair
// sampled (Redmi 15C<->Redmi 15C, Galaxy A17<->Galaxy A17, etc) - that result
// depended on the hard brand-match gate below (see requireBrandMatch).
// Laptop titles produced false positives even above 0.7 with the SAME gate -
// HP reuses the same CPU code (e.g. 125U) across different ProBook model
// lines (440/460/660), so CPU-code overlap alone doesn't disambiguate the
// model; fixing that needs per-brand model-number extraction, real added
// scope not built here.
//
// Every other category has no equivalent brand list, so requireBrandMatch is
// only ever passed true for mobiles-and-electronics (see dedupe.ts) - other
// categories rely on price-band (25%) + Jaccard >= MATCH_THRESHOLD alone,
// a real precision tradeoff for categories with templated/generic titles,
// deliberately not offset by lowering the threshold.

export type MatchableProduct = {
  id: string;
  platformSlug: string;
  title: string;
  price: number;
};

export const MATCH_THRESHOLD = 0.6;
const PRICE_BAND = 0.25;

const BRANDS = [
  'apple', 'samsung', 'xiaomi', 'redmi', 'poco', 'infinix', 'tecno', 'itel', 'oppo', 'vivo',
  'realme', 'huawei', 'honor', 'nokia', 'google', 'oneplus',
];
const STOPWORDS = new Set([
  'with', 'and', 'the', 'for', 'dual', 'sim', 'pta', 'approved', 'official', 'warranty',
  'genuine', 'brand', 'new', 'smartphone', 'mobile', 'phone', 'gb', 'tb', 'mercantile',
]);

function normalizeTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9+.]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

function extractBrand(title: string): string | null {
  const lower = title.toLowerCase();
  return BRANDS.find((b) => lower.includes(b)) ?? null;
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function scorePair(a: MatchableProduct, b: MatchableProduct, requireBrandMatch: boolean): number | null {
  if (requireBrandMatch) {
    const brandA = extractBrand(a.title);
    const brandB = extractBrand(b.title);
    if (!brandA || !brandB || brandA !== brandB) return null;
  }

  const minPrice = Math.min(a.price, b.price);
  const maxPrice = Math.max(a.price, b.price);
  if (maxPrice > minPrice * (1 + PRICE_BAND)) return null;

  return jaccard(normalizeTokens(a.title), normalizeTokens(b.title));
}

export type MatchPair = { productAId: string; productBId: string; confidence: number };

export function findMatches(products: MatchableProduct[], requireBrandMatch = true): MatchPair[] {
  const pairs: MatchPair[] = [];
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const a = products[i];
      const b = products[j];
      if (a.platformSlug === b.platformSlug) continue;

      const score = scorePair(a, b, requireBrandMatch);
      if (score === null || score < MATCH_THRESHOLD) continue;

      // Canonical ordering so (a, b) and (b, a) never both get stored.
      const [productAId, productBId] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
      pairs.push({ productAId, productBId, confidence: score });
    }
  }
  return pairs;
}
