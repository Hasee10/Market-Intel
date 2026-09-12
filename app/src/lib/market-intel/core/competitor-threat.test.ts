import { describe, it, expect } from 'vitest';

import {
  analyseThreats,
  MIN_CREDIBLE_REVIEWS,
  MIN_RATED_LISTINGS,
  type RatedListing,
} from './competitor-threat';

function listing(overrides: Partial<RatedListing> = {}): RatedListing {
  return {
    title: 'Crew Neck T-Shirt',
    platformName: 'Daraz',
    price: 800,
    rating: 4.2,
    ratingCount: 50,
    url: 'https://example.com/x',
    ...overrides,
  };
}

describe('analyseThreats', () => {
  describe('coverage gating', () => {
    it('reports not enough data when nothing carries a rating', () => {
      // The common case on fashion and auto: every source is a single
      // retailer and none of them publish ratings.
      const result = analyseThreats(
        [listing({ rating: null }), listing({ rating: null }), listing({ rating: null })],
        1000,
      );

      expect(result.hasEnoughData).toBe(false);
      expect(result.unratedCount).toBe(3);
      expect(result.threats).toEqual([]);
    });

    it('ignores ratings backed by too few reviews', () => {
      // A lone 5.0 from two people is not evidence of a strong competitor.
      const result = analyseThreats(
        Array.from({ length: 5 }, () =>
          listing({ rating: 5, ratingCount: MIN_CREDIBLE_REVIEWS - 1 }),
        ),
        1000,
      );

      expect(result.hasEnoughData).toBe(false);
      expect(result.unratedCount).toBe(5);
    });

    it(`needs at least ${MIN_RATED_LISTINGS} credibly rated listings to split a distribution`, () => {
      const two = analyseThreats([listing(), listing()], 1000);
      expect(two.hasEnoughData).toBe(false);

      const three = analyseThreats([listing(), listing(), listing()], 1000);
      expect(three.hasEnoughData).toBe(true);
    });

    it('counts the unrated alongside the rated rather than hiding them', () => {
      const result = analyseThreats(
        [listing(), listing(), listing(), listing({ rating: null }), listing({ rating: null })],
        1000,
      );

      expect(result.classified).toHaveLength(3);
      expect(result.unratedCount).toBe(2);
    });
  });

  describe('classification', () => {
    // Rating bar is the median of the rated set: 4.0, 4.5, 5.0 -> 4.5
    const set = [
      listing({ title: 'cheap-good', price: 500, rating: 5.0 }),
      listing({ title: 'cheap-bad', price: 600, rating: 4.0 }),
      listing({ title: 'dear-good', price: 1500, rating: 4.5 }),
    ];

    it('flags the cheaper, better-rated listing as the threat', () => {
      const result = analyseThreats(set, 1000);

      expect(result.threats.map((t) => t.title)).toEqual(['cheap-good']);
      expect(result.ratingBar).toBe(4.5);
    });

    it('does not call a cheaper listing a threat when it is rated below the pack', () => {
      // Undercutting with a poorly reviewed listing is not taking sales.
      const result = analyseThreats(set, 1000);
      expect(result.classified.find((l) => l.title === 'cheap-bad')?.band).toBe(
        'cheaper-but-weaker',
      );
    });

    it('treats a dearer, well-rated listing as a premium rather than a threat', () => {
      const result = analyseThreats(set, 1000);
      expect(result.classified.find((l) => l.title === 'dear-good')?.band).toBe('premium');
    });

    it('orders threats cheapest first', () => {
      const result = analyseThreats(
        [
          listing({ title: 'mid', price: 700, rating: 5 }),
          listing({ title: 'cheapest', price: 400, rating: 5 }),
          listing({ title: 'dear', price: 900, rating: 5 }),
          listing({ title: 'weak', price: 500, rating: 3 }),
        ],
        1000,
      );

      expect(result.threats.map((t) => t.title)).toEqual(['cheapest', 'mid', 'dear']);
    });

    it('uses the set median rather than a fixed bar, so an inflated category still splits', () => {
      // Every listing above 4.0 - a fixed 4.0 bar would call them all
      // well-rated and produce no signal at all.
      const result = analyseThreats(
        [
          listing({ title: 'a', price: 500, rating: 4.9 }),
          listing({ title: 'b', price: 600, rating: 4.8 }),
          listing({ title: 'c', price: 700, rating: 4.1 }),
        ],
        1000,
      );

      expect(result.ratingBar).toBe(4.8);
      expect(result.threats.map((t) => t.title)).toEqual(['a', 'b']);
    });
  });

  describe('without a seller price', () => {
    it('falls back to a quality read instead of guessing a side', () => {
      // A product with no sell_price set has no cheaper/dearer axis, so
      // nothing can honestly be called a threat.
      const result = analyseThreats(
        [
          listing({ title: 'good', rating: 5 }),
          listing({ title: 'mid', rating: 4.5 }),
          listing({ title: 'poor', rating: 3 }),
        ],
        null,
      );

      expect(result.threats).toEqual([]);
      expect(result.classified.find((l) => l.title === 'good')?.band).toBe('premium');
      expect(result.classified.find((l) => l.title === 'poor')?.band).toBe('no-advantage');
    });
  });

  it('handles an empty list', () => {
    const result = analyseThreats([], 1000);
    expect(result.hasEnoughData).toBe(false);
    expect(result.unratedCount).toBe(0);
  });
});
