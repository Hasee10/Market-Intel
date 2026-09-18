import { describe, it, expect } from 'vitest';
import { buildReturns } from './revenue-and-products';

// buildReturns is the report-side twin of getReturnStats (seller/returns.ts).
// These pin the rules the Orders page already follows so the two can never
// disagree in front of a seller: refunds and cancellations are separate,
// rates are over all orders, and no orders means no block - not a 0%.

const row = (status: string | null, amount = 1000) => ({ amount, status });

describe('buildReturns', () => {
  it('is null when the period has no orders', () => {
    expect(buildReturns([], [row('refunded')])).toBeNull();
  });

  it('separates refunds from cancellations and rates them over all orders', () => {
    const r = buildReturns(
      [row('delivered'), row('refunded', 500), row('refunded', 700), row('cancelled'), row('shipped')],
      [],
    )!;
    expect(r.returnRate.current).toBeCloseTo(40);
    expect(r.cancelRate.current).toBeCloseTo(20);
    expect(r.refundValue.current).toBe(1200);
    expect(r.refundedOrders).toBe(2);
    expect(r.cancelledOrders).toBe(1);
    // No prior orders -> no baseline, never a fabricated +100%.
    expect(r.returnRate.previous).toBeNull();
    expect(r.returnRate.changePct).toBeNull();
    expect(r.returnRate.direction).toBe('unknown');
  });

  it('reports 0% on real orders as a fact, with a prior-period comparison', () => {
    const r = buildReturns([row('delivered'), row('delivered')], [row('refunded'), row('delivered')])!;
    expect(r.returnRate.current).toBe(0);
    expect(r.returnRate.previous).toBe(50);
    expect(r.returnRate.direction).toBe('down');
  });
});
