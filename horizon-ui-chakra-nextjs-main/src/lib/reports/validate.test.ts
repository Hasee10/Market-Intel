import { describe, it, expect } from 'vitest';
import { validateSnapshot } from './validate';
import { baseSnapshot } from './test-fixtures';

describe('validateSnapshot', () => {
  it('passes for a clean minimal snapshot', () => {
    const result = validateSnapshot(baseSnapshot());
    expect(result.passed).toBe(true);
  });

  it('rejects a percentile outside 0-100 (the class of bug that produced +2657.7%)', () => {
    const result = validateSnapshot(
      baseSnapshot({
        pricePositioning: {
          yourMedianPrice: { value: 100, source: 'seller_private', asOf: '2026-08-04' },
          marketMedian: { value: 50, source: 'public_marketplace', asOf: '2026-08-04' },
          percentile: 2657.7,
          recommendedBand: null,
          trend: null,
        },
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'invalid_percentile')).toBe(true);
  });

  it('rejects a zero-count at-risk cohort - the "0 accounts" bug', () => {
    const result = validateSnapshot(
      baseSnapshot({
        customerHealth: {
          retentionRate: null,
          repeatPurchaseRate: null,
          avgClv: null,
          atRiskCount: 0,
          atRiskCohorts: [{ label: 'Win-back segment', count: 0, recoveryTargetPct: null }],
        },
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'zero_value_cohort')).toBe(true);
  });

  it('rejects an inventoryRisk section with 0 low-stock SKUs (should have been omitted, not shown)', () => {
    const result = validateSnapshot(
      baseSnapshot({ inventoryRisk: { lowStockSkuCount: 0, stockoutRiskSkus: [], supplyVoidOpportunities: null } }),
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'zero_value_section')).toBe(true);
  });

  it('rejects a client_safe snapshot that still carries internalNotes', () => {
    const result = validateSnapshot(
      baseSnapshot({
        privacy: {
          mode: 'client_safe',
          internalNotes: ['do not tell the client about X'],
          approval: { status: 'approved', reviewedBy: 'staff@ryvl.com', reviewedAt: '2026-08-04' },
        },
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'privacy_leak')).toBe(true);
  });

  it('flags an in-stock rate outside 0-1 as invalid', () => {
    const result = validateSnapshot(
      baseSnapshot({
        competitorBenchmarks: {
          scorecards: [
            {
              competitorName: 'Bad Data Co',
              platformName: 'Daraz',
              skuCount: 5,
              medianPrice: { value: 100, source: 'public_marketplace', asOf: '2026-08-04' },
              inStockRate: 1.5,
              repricingRate: null,
            },
          ],
          marketDefinitionSummary: 'Daraz · 5 identified',
        },
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'invalid_rate')).toBe(true);
  });
});
