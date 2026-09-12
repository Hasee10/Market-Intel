import { describe, it, expect } from 'vitest';
import { computePercentile } from './marketplace-and-pricing';

// Regression test for a real bug caught during the Grok-review implementation
// pass: migration 026 made market_scope_price_stats withhold p25/p75 below
// its sample-size threshold, and `strictNullChecks` is off project-wide (see
// tsconfig.json), so `null - number` silently producing NaN through this
// function's interpolation math would NOT have been caught by tsc - only by
// an actual test exercising the null case.
describe('computePercentile', () => {
  const basePricing = { minPrice: 100, p25: 200, median: 300, p75: 400, maxPrice: 500 };

  it('interpolates normally with a full 5-point band', () => {
    expect(computePercentile(300, basePricing)).toBe(50);
    expect(computePercentile(100, basePricing)).toBe(5);
    expect(computePercentile(500, basePricing)).toBe(95);
  });

  it('never produces NaN when p25/p75 are null (thin sample)', () => {
    const thin: { minPrice: number; p25: number | null; median: number; p75: number | null; maxPrice: number } = {
      minPrice: 100,
      p25: null,
      median: 300,
      p75: null,
      maxPrice: 500,
    };
    const result = computePercentile(250, thin);
    expect(result).not.toBeNull();
    expect(Number.isNaN(result)).toBe(false);
  });

  it('falls back to a 3-point min/median/max interpolation when p25/p75 are null', () => {
    const thin: { minPrice: number; p25: number | null; median: number; p75: number | null; maxPrice: number } = {
      minPrice: 100,
      p25: null,
      median: 300,
      p75: null,
      maxPrice: 500,
    };
    // Halfway between min(100) and median(300) should land near the 27-28th
    // percentile on a 5/50 stop pair, not the 5/25 pair a full band would use.
    const result = computePercentile(200, thin);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(5);
    expect(result).toBeLessThan(50);
  });

  it('returns null when there is no price to place', () => {
    expect(computePercentile(null, basePricing)).toBeNull();
  });
});
