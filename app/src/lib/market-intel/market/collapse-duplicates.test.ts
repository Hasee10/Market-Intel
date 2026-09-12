import { describe, it, expect } from 'vitest';

import { collapseDuplicateListings, type SimilarCandidate } from './candidate-search';

// One retailer publishing a product once per colour is the case this exists
// for. Counted raw it becomes a crowd that isn't there and drags the median
// toward whichever retailer has the deepest variant catalogue.

function candidate(overrides: Partial<SimilarCandidate> = {}): SimilarCandidate {
  return {
    id: Math.random().toString(36).slice(2),
    title: '3 Piece - Printed Lawn Suit',
    price: 3832,
    currency: 'PKR',
    url: 'https://example.com/x',
    imageUrl: null,
    categorySlug: 'lawn',
    platformId: 'p-sapphire',
    platformName: 'Sapphire Online',
    rating: null,
    ratingCount: null,
    soldCount: null,
    sellerExternalId: null,
    ...overrides,
  };
}

describe('collapseDuplicateListings', () => {
  it('collapses same platform, title and price into one row carrying the count', () => {
    const collapsed = collapseDuplicateListings([candidate(), candidate(), candidate()]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].duplicateCount).toBe(3);
  });

  it('keeps listings of the same title at different prices, which are real alternatives', () => {
    // A buyer could choose between these, so they are not duplicates.
    const collapsed = collapseDuplicateListings([
      candidate({ price: 3832 }),
      candidate({ price: 3900 }),
    ]);

    expect(collapsed).toHaveLength(2);
    expect(collapsed.every((c) => c.duplicateCount === 1)).toBe(true);
  });

  it('keeps the same title and price on different platforms apart', () => {
    // Two retailers charging the same is genuine competition, not one
    // retailer listing twice.
    const collapsed = collapseDuplicateListings([
      candidate({ platformId: 'p-sapphire' }),
      candidate({ platformId: 'p-daraz' }),
    ]);

    expect(collapsed).toHaveLength(2);
  });

  it('treats titles differing only by whitespace and case as the same', () => {
    const collapsed = collapseDuplicateListings([
      candidate({ title: '3 Piece - Printed Lawn Suit' }),
      candidate({ title: '3  PIECE -  printed lawn suit  ' }),
    ]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].duplicateCount).toBe(2);
  });

  it('never merges rows whose price is unknown', () => {
    // Null prices are not evidence of being the same offer, and merging on
    // them would invent a duplicate out of two genuinely separate listings.
    const collapsed = collapseDuplicateListings([
      candidate({ price: null }),
      candidate({ price: null }),
    ]);

    expect(collapsed).toHaveLength(2);
  });

  it('keeps the best-evidenced copy of a collapsed group', () => {
    // Among identically-priced variants, the one carrying a rating and a
    // sold count is the more useful row to show.
    const collapsed = collapseDuplicateListings([
      candidate({ id: 'bare', ratingCount: null, soldCount: null }),
      candidate({ id: 'rich', ratingCount: 40, soldCount: 120 }),
      candidate({ id: 'bare2', ratingCount: null, soldCount: null }),
    ]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].id).toBe('rich');
    expect(collapsed[0].duplicateCount).toBe(3);
  });

  it('leaves a list with no duplicates untouched, each marked as one', () => {
    const collapsed = collapseDuplicateListings([
      candidate({ title: 'Lawn Suit A' }),
      candidate({ title: 'Lawn Suit B' }),
    ]);

    expect(collapsed).toHaveLength(2);
    expect(collapsed.map((c) => c.duplicateCount)).toEqual([1, 1]);
  });

  it('handles an empty list', () => {
    expect(collapseDuplicateListings([])).toEqual([]);
  });
});
