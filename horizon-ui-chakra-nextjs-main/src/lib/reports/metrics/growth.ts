import type { GrowthMetric } from '../schema';

// Direct fix for a live bug found by inspecting the current report's own
// demo output: "PRICE INDEX SCORE 2757.7 / +2657.7% above median" - a
// percentage computed against a near-zero baseline. No caller of this
// function can produce that number again: below MIN_BASELINE, changePct is
// null, not a huge/undefined number, and null must be rendered as
// "N/A"/omitted by every renderer, never coerced to 0 or hidden silently.
const MIN_BASELINE = 0.01;

export function buildGrowthMetric(current: number, previous: number | null): GrowthMetric {
  if (previous == null || Math.abs(previous) < MIN_BASELINE) {
    return {
      current,
      previous,
      changePct: null,
      changeAbs: previous == null ? null : current - previous,
      direction: previous == null ? 'unknown' : current > previous ? 'up' : current < previous ? 'down' : 'flat',
    };
  }

  const changeAbs = current - previous;
  const changePct = (changeAbs / previous) * 100;
  const direction: GrowthMetric['direction'] = changeAbs > 0 ? 'up' : changeAbs < 0 ? 'down' : 'flat';

  return { current, previous, changePct, changeAbs, direction };
}

// Percentile/index-style ratios (e.g. seller price vs. market median) share
// the same near-zero-denominator failure mode as period-over-period growth,
// so route them through the same guard instead of each call site
// reimplementing its own division.
export function safeRatio(numerator: number, denominator: number | null): number | null {
  if (denominator == null || Math.abs(denominator) < MIN_BASELINE) return null;
  return numerator / denominator;
}
