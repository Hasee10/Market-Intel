import { describe, it, expect } from 'vitest';
import { buildSectionPlan, ROWS_PER_TABLE_PAGE, MAX_CONTINUATION_PAGES } from './section-plan';
import { baseSnapshot } from './test-fixtures';

describe('buildSectionPlan - inclusion rules (floor)', () => {
  it('a thin seller with no data gets only cover + methodology - no padding to look substantial', () => {
    const plan = buildSectionPlan(baseSnapshot());
    const kinds = plan.sections.map((s) => s.kind);
    expect(kinds).toEqual(['cover', 'methodology']);
    expect(plan.totalPageCount).toBe(2);
  });

  it('never includes inventory_risk when lowStockSkuCount is 0 - the "0 SKUs...On track" bug', () => {
    const snapshot = baseSnapshot({
      inventoryRisk: { lowStockSkuCount: 0, stockoutRiskSkus: [], supplyVoidOpportunities: null },
    });
    // this snapshot shape should never be constructed by a real collector
    // (revenue-and-products.ts returns null instead) - this test guards the
    // section planner's own defense-in-depth omission rule regardless.
    const plan = buildSectionPlan(snapshot);
    expect(plan.sections.some((s) => s.kind === 'inventory_risk')).toBe(false);
  });

  it('never includes customer_health as a 0-count "Win-Back Segment" style section when null', () => {
    const plan = buildSectionPlan(baseSnapshot({ customerHealth: null }));
    expect(plan.sections.some((s) => s.kind === 'customer_health')).toBe(false);
  });

  it('omits portfolio_contribution for a single-category seller', () => {
    const plan = buildSectionPlan(
      baseSnapshot({
        productPerformance: {
          activeProductCount: 3,
          contributionBasis: 'inventory_value',
          topProducts: [{ title: 'Widget', sku: 'W1', contributionShare: 1 }],
          categoryBreakdown: [{ category: 'Electronics', value: 100, share: 1 }],
        },
      }),
    );
    expect(plan.sections.some((s) => s.kind === 'portfolio_contribution')).toBe(false);
    expect(plan.sections.some((s) => s.kind === 'sku_performance')).toBe(true);
  });

  it('omits roadmap when fewer than 2 recommendations exist', () => {
    const plan = buildSectionPlan(
      baseSnapshot({ recommendations: [{ id: 'r1', priority: 'high', text: 'Do X', basedOn: [], aiGenerated: false }] }),
    );
    expect(plan.sections.some((s) => s.kind === 'recommendations')).toBe(true);
    expect(plan.sections.some((s) => s.kind === 'roadmap')).toBe(false);
  });
});

describe('buildSectionPlan - pagination (ceiling)', () => {
  // MAX_CONTINUATION_PAGES is 0 (see section-plan.ts's comment on it): the
  // reference deck never emits a continuation slide for either table this
  // feeds, no matter how many rows exist - it stays on one page and
  // truncates with a "+N more" note. These two tests used to document the
  // opposite (up to 3 pages before truncating), which was the "dump every
  // competitor across 3 slides" anti-pattern the report brief calls out by
  // name - see git history for the pre-fix version if that behaviour is
  // ever needed again.
  it('a competitor table larger than one page truncates rather than continuing to a second slide', () => {
    const scorecards = Array.from({ length: 12 }, (_, i) => ({
      competitorName: `Competitor ${i}`,
      platformName: 'Daraz',
      skuCount: 10,
      medianPrice: { value: 1000, source: 'public_marketplace' as const, asOf: '2026-08-04' },
      inStockRate: 0.9,
      repricingRate: 0.1,
    }));
    const plan = buildSectionPlan(
      baseSnapshot({ competitorBenchmarks: { scorecards, marketDefinitionSummary: 'Daraz · 12 identified' } }),
    );
    const pages = plan.sections.filter((s) => s.kind === 'competitor_tracking');
    expect(pages.length).toBe(MAX_CONTINUATION_PAGES + 1);
    expect(pages[0].truncated).toBe(true);
    expect(pages[0].truncatedCount).toBe(12 - ROWS_PER_TABLE_PAGE);
  });

  it('caps at a single page and reports a truncated count instead of growing without bound', () => {
    const scorecards = Array.from({ length: 40 }, (_, i) => ({
      competitorName: `Competitor ${i}`,
      platformName: 'Daraz',
      skuCount: 10,
      medianPrice: { value: 1000, source: 'public_marketplace' as const, asOf: '2026-08-04' },
      inStockRate: 0.9,
      repricingRate: 0.1,
    }));
    const plan = buildSectionPlan(
      baseSnapshot({ competitorBenchmarks: { scorecards, marketDefinitionSummary: 'Daraz · 40 identified' } }),
    );
    const pages = plan.sections.filter((s) => s.kind === 'competitor_tracking');
    expect(pages.length).toBe(MAX_CONTINUATION_PAGES + 1);
    const last = pages[pages.length - 1];
    expect(last.truncated).toBe(true);
    expect(last.truncatedCount).toBe(40 - (MAX_CONTINUATION_PAGES + 1) * ROWS_PER_TABLE_PAGE);
  });
});
