import { describe, it, expect } from 'vitest';
import { buildGrowthMetric, safeRatio } from './growth';

describe('buildGrowthMetric', () => {
  it('never produces the +2657.7%-style blowup from a near-zero baseline', () => {
    const m = buildGrowthMetric(275.7, 0.001);
    expect(m.changePct).toBeNull();
    expect(m.direction).toBe('up');
  });

  it('computes a normal percentage change correctly', () => {
    const m = buildGrowthMetric(150, 100);
    expect(m.changePct).toBe(50);
    expect(m.direction).toBe('up');
  });

  it('handles a null baseline (no prior period) as unknown direction, not a fabricated 0', () => {
    const m = buildGrowthMetric(500, null);
    expect(m.previous).toBeNull();
    expect(m.changePct).toBeNull();
    expect(m.direction).toBe('unknown');
  });

  it('flags a decline as direction "down" with a negative changePct', () => {
    const m = buildGrowthMetric(80, 100);
    expect(m.changePct).toBe(-20);
    expect(m.direction).toBe('down');
  });

  it('flags no change as "flat"', () => {
    const m = buildGrowthMetric(100, 100);
    expect(m.changePct).toBe(0);
    expect(m.direction).toBe('flat');
  });
});

describe('safeRatio', () => {
  it('returns null instead of a huge number when the denominator is near zero', () => {
    expect(safeRatio(1000, 0.001)).toBeNull();
  });

  it('returns null when the denominator is null', () => {
    expect(safeRatio(1000, null)).toBeNull();
  });

  it('computes a normal ratio', () => {
    expect(safeRatio(50, 200)).toBe(0.25);
  });
});
