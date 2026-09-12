import { describe, it, expect } from 'vitest';
import { formatPercent } from './design-tokens';

describe('formatPercent', () => {
  // A real generated report showed "+100%" for an in-stock rate and
  // "+87.0%" for a SKU's inventory-value share - both nonsensical, since
  // neither is a change from a prior value. This function is only ever
  // called with plain rates/shares (see render/pptx/build-deck.ts and
  // render/pdf/build-pdf.ts) - period-over-period deltas are formatted
  // separately in components.ts's kpiCardFromGrowth, which has its own
  // explicit sign logic. No call site needs a "+" prefix here.
  it('never adds a "+" prefix - every call site is a plain rate or share, not a delta', () => {
    expect(formatPercent(100, 0)).toBe('100%');
    expect(formatPercent(87, 1)).toBe('87.0%');
    expect(formatPercent(0, 0)).toBe('0%');
  });

  it('does not add a prefix for negative values either', () => {
    expect(formatPercent(-12.5, 1)).toBe('-12.5%');
  });

  it('renders null as N/A rather than a blank or fabricated 0', () => {
    expect(formatPercent(null)).toBe('N/A');
  });
});
