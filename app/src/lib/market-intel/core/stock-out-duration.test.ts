import { describe, it, expect } from 'vitest';

import {
  classifyStockOutUrgency,
  computeStockOutDuration,
  formatStockOutDuration,
} from './stock-out-duration';

const NOW = new Date('2026-09-15T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('computeStockOutDuration', () => {
  it('measures from the last confirmed in-stock moment and marks it confirmed', () => {
    const result = computeStockOutDuration(daysAgo(12), daysAgo(40), NOW);
    expect(result).toEqual({ days: 12, confirmed: true });
  });

  it('falls back to the earliest observation as an unconfirmed floor when never seen in stock', () => {
    // We have never once seen this product in stock - "out for at least
    // this long, since our records begin", not a witnessed transition.
    const result = computeStockOutDuration(null, daysAgo(9), NOW);
    expect(result).toEqual({ days: 9, confirmed: false });
  });

  it('returns null when there is no history at all to anchor on', () => {
    expect(computeStockOutDuration(null, null, NOW)).toBeNull();
  });

  it('never goes negative on a clock skew between the two timestamps', () => {
    // A last-in-stock observation timestamped fractionally after "now"
    // (recorded on a different machine's clock) must not read as -1 days.
    const future = new Date(NOW.getTime() + 60_000).toISOString();
    expect(computeStockOutDuration(future, null, NOW)?.days).toBe(0);
  });

  it('prefers the confirmed anchor over the floor when both are present', () => {
    const result = computeStockOutDuration(daysAgo(5), daysAgo(100), NOW);
    expect(result?.days).toBe(5);
    expect(result?.confirmed).toBe(true);
  });
});

describe('classifyStockOutUrgency', () => {
  it('is fresh under 3 days - inside the scraper cadence noise floor', () => {
    expect(classifyStockOutUrgency(0)).toBe('fresh');
    expect(classifyStockOutUrgency(2)).toBe('fresh');
  });

  it('is notable from 3 up to 14 days', () => {
    expect(classifyStockOutUrgency(3)).toBe('notable');
    expect(classifyStockOutUrgency(13)).toBe('notable');
  });

  it('is extended at 14 days and beyond', () => {
    expect(classifyStockOutUrgency(14)).toBe('extended');
    expect(classifyStockOutUrgency(90)).toBe('extended');
  });
});

describe('formatStockOutDuration', () => {
  it('states a confirmed duration plainly', () => {
    expect(formatStockOutDuration({ days: 12, confirmed: true })).toBe('Out 12 days');
  });

  it('marks an unconfirmed duration as a floor, not a fact', () => {
    expect(formatStockOutDuration({ days: 9, confirmed: false })).toBe('Out 9+ days');
  });

  it('uses the singular for exactly one day', () => {
    expect(formatStockOutDuration({ days: 1, confirmed: true })).toBe('Out 1 day');
  });

  it('has distinct wording for zero days, confirmed vs not', () => {
    expect(formatStockOutDuration({ days: 0, confirmed: true })).toBe('Out since today');
    expect(formatStockOutDuration({ days: 0, confirmed: false })).toBe('Out - first seen today');
  });
});
