import type { ReportSnapshot } from './schema';

export type SectionKind =
  | 'cover'
  | 'executive_snapshot'
  | 'market_position'
  | 'pricing_intelligence'
  | 'competitor_tracking'
  | 'sku_performance'
  | 'inventory_risk'
  | 'portfolio_contribution'
  | 'customer_health'
  | 'recommendations'
  | 'roadmap'
  | 'methodology'
  | 'appendix';

export interface PlannedSection {
  kind: SectionKind;
  title: string;
  /** 0-indexed page/slide within this section - 0 is always the primary page. */
  page: number;
  /** How many pages this section spans in total (>1 only for overflowing tables). */
  pageCount: number;
  /** For table-backed sections: the exact row slice to render on this page. */
  rowRange?: [number, number];
  /** True on the last page of a section whose data exceeded MAX_CONTINUATION_PAGES. */
  truncated?: boolean;
  truncatedCount?: number;
}

export interface SectionPlan {
  sections: PlannedSection[];
  totalPageCount: number;
  omitted: { kind: SectionKind; reason: string }[];
}

export const ROWS_PER_TABLE_PAGE = 5; // matches the geometry the original hand-authored template used
export const MAX_CONTINUATION_PAGES = 2; // §5's ceiling rule - at most 3 pages total (1 + 2 continuations) per table section

function paginate(
  kind: SectionKind,
  title: string,
  totalRows: number,
): PlannedSection[] {
  if (totalRows === 0) return [{ kind, title, page: 0, pageCount: 1 }];

  const naturalPages = Math.ceil(totalRows / ROWS_PER_TABLE_PAGE);
  const pageCount = Math.min(naturalPages, MAX_CONTINUATION_PAGES + 1);
  const rowsShown = pageCount * ROWS_PER_TABLE_PAGE;
  const truncatedCount = totalRows > rowsShown ? totalRows - rowsShown : 0;

  return Array.from({ length: pageCount }, (_, i) => {
    const start = i * ROWS_PER_TABLE_PAGE;
    const end = Math.min(start + ROWS_PER_TABLE_PAGE, totalRows);
    const isLast = i === pageCount - 1;
    return {
      kind,
      title: i === 0 ? title : `${title} (continued)`,
      page: i,
      pageCount,
      rowRange: [start, end] as [number, number],
      truncated: isLast && truncatedCount > 0,
      truncatedCount: isLast && truncatedCount > 0 ? truncatedCount : undefined,
    };
  });
}

// Applies docs/reports-v2-architecture.md §5 in code: every section here is
// either fully present (inclusion rule passed) or fully absent (omitted,
// with a reason recorded for the methodology/debug trail) - there is no
// third state where a section renders with a misleading zero/empty value.
// Total output length is a pure function of this plan, never a fixed number.
export function buildSectionPlan(snapshot: ReportSnapshot): SectionPlan {
  const sections: PlannedSection[] = [];
  const omitted: SectionPlan['omitted'] = [];
  const omit = (kind: SectionKind, reason: string) => omitted.push({ kind, reason });

  sections.push({ kind: 'cover', title: 'Cover', page: 0, pageCount: 1 });

  const hasExecutiveData = snapshot.revenue != null || snapshot.productPerformance != null;
  if (hasExecutiveData) {
    sections.push({ kind: 'executive_snapshot', title: 'Executive Snapshot & Key Signals', page: 0, pageCount: 1 });
  } else {
    omit('executive_snapshot', 'No revenue or product data available for this period.');
  }

  if (snapshot.marketplacePerformance) {
    sections.push({ kind: 'market_position', title: 'Market Position & Benchmark Percentiles', page: 0, pageCount: 1 });
  } else {
    omit('market_position', 'No market-definition coverage for this category.');
  }

  if (snapshot.pricePositioning) {
    sections.push({ kind: 'pricing_intelligence', title: 'Pricing Intelligence', page: 0, pageCount: 1 });
  } else {
    omit('pricing_intelligence', 'No price positioning data available.');
  }

  if (snapshot.competitorBenchmarks && snapshot.competitorBenchmarks.scorecards.length > 0) {
    sections.push(
      ...paginate(
        'competitor_tracking',
        'Marketplace & Competitor Tracking',
        snapshot.competitorBenchmarks.scorecards.length,
      ),
    );
  } else {
    omit('competitor_tracking', 'No named-seller source covers this category (only Daraz names sellers today).');
  }

  if (snapshot.productPerformance && snapshot.productPerformance.topProducts.length > 0) {
    sections.push(
      ...paginate('sku_performance', 'SKU Performance', snapshot.productPerformance.topProducts.length),
    );
  } else {
    omit('sku_performance', 'No active products.');
  }

  // Defense-in-depth, not the only guard: collectors/revenue-and-products.ts
  // already returns null (not a 0-count object) when there's nothing to
  // flag, but the section planner checks the actual count too rather than
  // trusting object-existence alone - a caller-constructed snapshot (tests,
  // a future collector) that leaves lowStockSkuCount at 0 must still never
  // render this section, matching the brief's "never show 0 SKUs" rule.
  if (snapshot.inventoryRisk && snapshot.inventoryRisk.lowStockSkuCount > 0) {
    sections.push({ kind: 'inventory_risk', title: 'Inventory & Demand Risk', page: 0, pageCount: 1 });
  } else {
    omit('inventory_risk', 'No SKUs below the low-stock threshold and no supply-void signals - a healthy state, not a section.');
  }

  if (snapshot.productPerformance && snapshot.productPerformance.categoryBreakdown.length >= 2) {
    sections.push({ kind: 'portfolio_contribution', title: 'Product Portfolio Contribution', page: 0, pageCount: 1 });
  } else {
    omit('portfolio_contribution', 'Fewer than 2 categories - no portfolio framing to show.');
  }

  if (snapshot.customerHealth) {
    sections.push({ kind: 'customer_health', title: 'Customer Health & Retention', page: 0, pageCount: 1 });
  } else {
    omit('customer_health', 'Below minimum customer count for reliable retention scoring.');
  }

  if (snapshot.recommendations.length > 0) {
    sections.push({ kind: 'recommendations', title: 'Prioritised Recommendations', page: 0, pageCount: 1 });
  } else {
    omit('recommendations', 'No actionable recommendations generated this period.');
  }

  if (snapshot.strategicRoadmap && snapshot.strategicRoadmap.length >= 2) {
    sections.push({ kind: 'roadmap', title: 'Strategic Action Roadmap', page: 0, pageCount: 1 });
  } else {
    omit('roadmap', 'Fewer than 2 recommendations - not enough to sequence into phases.');
  }

  sections.push({ kind: 'methodology', title: 'Methodology, Privacy & Data Sources', page: 0, pageCount: 1 });

  if (snapshot.metadata.mode === 'internal' && snapshot.appendix && Object.keys(snapshot.appendix).length > 0) {
    sections.push({ kind: 'appendix', title: 'Appendix', page: 0, pageCount: 1 });
  }

  return { sections, totalPageCount: sections.length, omitted };
}
