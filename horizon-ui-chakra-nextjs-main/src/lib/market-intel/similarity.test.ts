import { describe, it, expect } from 'vitest';
import {
  tokenize,
  jaccard,
  buildIdf,
  idfCosine,
  matchStrength,
  MIN_COMPETITOR_CONFIDENCE,
} from './similarity';

describe('tokenize', () => {
  it('treats a plural and its singular as the same token', () => {
    expect(jaccard(tokenize('Laptops'), tokenize('Laptop'))).toBe(1);
    expect(jaccard(tokenize('HP Laptop Core i5'), tokenize('Laptops'))).toBeGreaterThan(0);
  });

  it('does not mangle a short word ending in s or a double-s word', () => {
    expect(tokenize('Gas Stove')).toContain('gas');
    expect(tokenize('Sunglasses')).toContain('sunglass');
  });
});

describe('buildIdf', () => {
  it('weights a token in every document below one that appears in a single document', () => {
    const idf = buildIdf([
      tokenize('Samsung Galaxy A15'),
      tokenize('Samsung Galaxy S24'),
      tokenize('Samsung Galaxy Z Fold'),
    ]);

    expect(idf.get('samsung')!).toBeLessThan(idf.get('a15')!);
    expect(idf.get('galaxy')!).toBeLessThan(idf.get('fold')!);
  });

  it('keeps every weight positive so a single-document corpus still scores', () => {
    const idf = buildIdf([tokenize('Samsung Galaxy A15')]);

    for (const weight of idf.values()) expect(weight).toBeGreaterThan(0);
  });
});

describe('idfCosine', () => {
  // The case this whole mechanism exists for: two phones from one family
  // share the brand prefix and nothing else, and plain overlap cannot tell
  // that apart from a real match.
  it('separates two phones in a family that plain jaccard scores as a strong match', () => {
    const pool = [
      tokenize('Samsung Galaxy A15 128GB'),
      tokenize('Samsung Galaxy A15 64GB'),
      tokenize('Samsung Galaxy S24 Ultra'),
      tokenize('Samsung Galaxy Z Fold 5'),
      tokenize('Samsung Galaxy A54'),
    ];
    const idf = buildIdf(pool);

    const seller = tokenize('Samsung Galaxy A15');
    const sameProduct = tokenize('Samsung Galaxy A15 128GB');
    const differentProduct = tokenize('Samsung Galaxy Z Fold 5');

    // Plain jaccard rates the wrong product well above the inclusion gate,
    // which is exactly the reported bug.
    expect(jaccard(seller, differentProduct)).toBeGreaterThan(MIN_COMPETITOR_CONFIDENCE);

    // Weighted, the real match must win by a clear margin.
    const right = idfCosine(seller, sameProduct, idf);
    const wrong = idfCosine(seller, differentProduct, idf);
    expect(right).toBeGreaterThan(wrong);
    expect(right - wrong).toBeGreaterThan(0.2);
  });

  it('scores identical titles as 1 regardless of how common their tokens are', () => {
    const idf = buildIdf([tokenize('Samsung Galaxy A15'), tokenize('Samsung Galaxy A15')]);

    expect(idfCosine(tokenize('Samsung Galaxy A15'), tokenize('Samsung Galaxy A15'), idf)).toBe(1);
  });

  it('scores titles with no shared token as 0', () => {
    const idf = buildIdf([tokenize('Samsung Galaxy A15'), tokenize('Wooden Dining Chair')]);

    expect(idfCosine(tokenize('Samsung Galaxy A15'), tokenize('Wooden Dining Chair'), idf)).toBe(0);
  });

  it('returns 0 for an empty token set rather than dividing by zero', () => {
    const idf = buildIdf([tokenize('Samsung Galaxy A15')]);

    expect(idfCosine(new Set(), tokenize('Samsung Galaxy A15'), idf)).toBe(0);
    expect(idfCosine(tokenize('Samsung Galaxy A15'), new Set(), idf)).toBe(0);
  });

  it('falls back to a neutral weight for a token missing from the corpus', () => {
    const idf = buildIdf([tokenize('Samsung Galaxy A15')]);

    // 'nokia'/'lumia' are absent from the corpus entirely - this must score,
    // not throw or silently return NaN.
    const score = idfCosine(tokenize('Nokia Lumia'), tokenize('Samsung Galaxy A15'), idf);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBe(0);
  });
});

describe('matchStrength', () => {
  it('bands an exact match as strong and a brand-prefix-only overlap as loose', () => {
    expect(matchStrength(1)).toBe('strong');
    expect(matchStrength(0.35)).toBe('likely');
    expect(matchStrength(0.1)).toBe('loose');
  });
});
