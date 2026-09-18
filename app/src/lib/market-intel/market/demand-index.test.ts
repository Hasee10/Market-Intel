import { describe, it, expect } from 'vitest';

import { computeIndex } from './demand-index';

// computeIndex is the only arithmetic this module owns; the percentiles
// come from the database (migration 061). The cases are the weighting and
// what happens when a signal is missing.

describe('computeIndex', () => {
  it('weights sales 45, reviews 35, position 20 when all three are present', () => {
    const { index, signalsUsed } = computeIndex({ soldPct: 1, reviewsPct: 0, rankPct: 0 });
    expect(index).toBe(45);
    expect(signalsUsed).toEqual(['sales', 'reviews', 'position']);
  });

  it('rescales to the signals the listing actually has', () => {
    // No rank yet (pre-060 listing) and no sold count (non-Daraz): reviews
    // is the only signal, so its percentile IS the index.
    const { index, signalsUsed } = computeIndex({ soldPct: null, reviewsPct: 0.8, rankPct: null });
    expect(index).toBe(80);
    expect(signalsUsed).toEqual(['reviews']);
  });

  it('gives zero and no signals when the listing reports nothing', () => {
    expect(computeIndex({ soldPct: null, reviewsPct: null, rankPct: null })).toEqual({ index: 0, signalsUsed: [] });
  });

  it('reads a listing at the top of every signal as 100', () => {
    expect(computeIndex({ soldPct: 1, reviewsPct: 1, rankPct: 1 }).index).toBe(100);
  });

  it('treats a reported zero differently from not reported', () => {
    // Sold 0 (bottom percentile) drags the index; sold null does not.
    const reportedZero = computeIndex({ soldPct: 0, reviewsPct: 0.9, rankPct: null }).index;
    const notReported = computeIndex({ soldPct: null, reviewsPct: 0.9, rankPct: null }).index;
    expect(reportedZero).toBeLessThan(notReported);
    expect(notReported).toBe(90);
  });
});
