import { describe, it, expect } from 'vitest';

import { scorePlatforms } from './placement';

// scorePlatforms is pure and is where every decision about the score lives,
// so it is tested directly rather than through the database. The cases
// below are the ones a seller would argue with: what leads, what happens
// when a signal is missing everywhere, and that price never changes the
// order.

function platform(name: string, over: Partial<Parameters<typeof scorePlatforms>[0][number]> = {}) {
  return {
    platformName: name,
    marketProductId: `id-${name}`,
    title: 'Same product',
    url: 'https://x',
    imageUrl: null,
    confidence: 0.8,
    otherListingsOnPlatform: 0,
    price: 1000,
    currency: 'PKR',
    inStock: true,
    rating: null as number | null,
    ratingCount: null as number | null,
    soldCount: null as number | null,
    availability: null as number | null,
    history: [],
    ...over,
  };
}

describe('scorePlatforms', () => {
  it('ranks the platform with the strongest demand signals first', () => {
    const { scored, signalsUsed } = scorePlatforms([
      platform('Daraz', { soldCount: 500, ratingCount: 120, rating: 4.5, availability: 0.9 }),
      platform('Al-Fatah', { soldCount: 50, ratingCount: 10, rating: 4.8, availability: 1 }),
    ]);

    expect(scored[0].platformName).toBe('Daraz');
    expect(signalsUsed).toEqual(['sales', 'reviews', 'rating', 'availability']);
    // Daraz leads on sales and reviews (the heavy weights); Al-Fatah's better
    // rating and availability do not overturn that.
    expect(scored[0].score).toBeGreaterThan(scored[1].score);
  });

  it('drops a signal no platform reports and rescales the rest to 100', () => {
    // No sold counts anywhere - common outside Daraz.
    const { scored, signalsUsed } = scorePlatforms([
      platform('A', { ratingCount: 100, rating: 5, availability: 1 }),
      platform('B', { ratingCount: 100, rating: 5, availability: 1 }),
    ]);

    expect(signalsUsed).toEqual(['reviews', 'rating', 'availability']);
    expect(scored[0].components.sales).toBeNull();
    // Identical on every available signal → both score the full 100, not 60.
    expect(scored[0].score).toBe(100);
    expect(scored[1].score).toBe(100);
  });

  it('scores a platform 0 on a signal it lacks when another platform has it', () => {
    const { scored } = scorePlatforms([
      platform('Has', { soldCount: 200 }),
      platform('Lacks', { soldCount: null }),
    ]);

    const has = scored.find((p) => p.platformName === 'Has')!;
    const lacks = scored.find((p) => p.platformName === 'Lacks')!;
    expect(has.components.sales).toBe(100); // only signal available → rescaled to the whole score
    expect(lacks.components.sales).toBe(0);
  });

  it('never lets price change the ranking', () => {
    const { scored } = scorePlatforms([
      platform('Cheap', { price: 500, soldCount: 10 }),
      platform('Pricey', { price: 5000, soldCount: 100 }),
    ]);

    expect(scored[0].platformName).toBe('Pricey');
  });

  it('breaks a tie on review count, and returns every component for the client to show', () => {
    const { scored } = scorePlatforms([
      platform('Few', { rating: 4, ratingCount: 5 }),
      platform('Many', { rating: 4, ratingCount: 50 }),
    ]);

    expect(scored[0].platformName).toBe('Many');
    expect(Object.keys(scored[0].components)).toEqual(['sales', 'reviews', 'rating', 'availability']);
  });

  it('returns no signals and zero scores when nothing is reported at all', () => {
    const { scored, signalsUsed } = scorePlatforms([platform('A'), platform('B')]);

    expect(signalsUsed).toEqual([]);
    expect(scored.every((p) => p.score === 0)).toBe(true);
  });
});
