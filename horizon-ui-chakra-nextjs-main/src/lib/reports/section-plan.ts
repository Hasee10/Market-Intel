import type { ReportSnapshot } from './schema';
import { formatCurrency } from './design-tokens';

export type SectionKind =
  | 'cover'
  | 'toc'
  | 'section_divider'
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
  /** Chapter position, set on divider slides and their opening section. */
  chapterNumber?: number;
  chapterTotal?: number;
  /** Divider-only: subtitle + the 3-stat strip beneath the title. */
  dividerSubtitle?: string;
  dividerStats?: { label: string; value: string }[];
}

export interface TocEntry {
  number: number | null;
  title: string;
  status: 'included' | 'not_enough_data' | 'omitted';
}

export interface SectionPlan {
  sections: PlannedSection[];
  totalPageCount: number;
  omitted: { kind: SectionKind; reason: string }[];
  toc: TocEntry[];
  /** Content sections actually included, i.e. excluding cover/toc/dividers/methodology. */
  includedSectionCount: number;
  candidateSectionCount: number;
}

// 'aiSummary' is rendered in the Executive Snapshot's insight card, not
// duplicated here - the appendix slide is for other internal notes. Both
// renderers (build-deck.ts, build-pdf.ts) and this inclusion gate must use
// the exact same filter, or the gate can decide "there is content" while the
// renderer then filters everything out and draws an empty box - which is
// exactly what happened when appendix carried only an aiSummary key and the
// gate checked Object.keys(...).length > 0 without excluding it first.
export function appendixEntries(appendix: Record<string, unknown> | null | undefined): [string, unknown][] {
  return Object.entries(appendix ?? {}).filter(([key]) => key !== 'aiSummary');
}

export const ROWS_PER_TABLE_PAGE = 5;
// The reference deck (docs/report-reference/v3/New-Slides.pptx) never emits a
// continuation slide for either table this feeds (competitor_tracking,
// sku_performance) - even with far more rows than fit on one page, it stays
// on a single page and truncates with a "+N more - see dashboard" note
// (verified: zero "(continued)" slides anywhere in that deck's shape dump,
// including a competitor table with 40+ rows reduced to "+37 more..."). This
// was previously 2, allowing up to 3 pages total and producing exactly the
// "dump every competitor across 3 slides" anti-pattern the report brief
// explicitly calls out. 0 means: always exactly one page, truncate the rest.
export const MAX_CONTINUATION_PAGES = 0;

/**
 * Below this many content sections, the report skips the table-of-contents
 * and chapter-divider slides entirely. A 3-slide report does not need a
 * contents page or chapter breaks - adding them would be padding, which is
 * exactly what the "never inflate a thin report" rule forbids.
 */
export const MIN_SECTIONS_FOR_CHAPTERS = 5;

/** Chapter grouping - a divider opens each chapter that has any included section. */
const CHAPTERS: { title: string; subtitle: string; kinds: SectionKind[] }[] = [
  {
    title: 'Executive Snapshot',
    subtitle: 'The headline numbers for this period, and what moved them.',
    kinds: ['executive_snapshot'],
  },
  {
    title: 'Market Position & Pricing',
    subtitle: 'Where your pricing sits against the tracked market, and the band the data supports.',
    kinds: ['market_position', 'pricing_intelligence'],
  },
  {
    title: 'Marketplace & Competitor Tracking',
    subtitle: 'Who moved on price, who ran out of stock, and where that leaves you.',
    kinds: ['competitor_tracking'],
  },
  {
    title: 'Your Catalogue',
    subtitle: 'Product contribution, portfolio mix, and the SKUs at risk of stocking out.',
    kinds: ['sku_performance', 'portfolio_contribution', 'inventory_risk'],
  },
  {
    title: 'Customer Health',
    subtitle: 'Retention, repeat purchase behaviour, and the cohorts worth acting on.',
    kinds: ['customer_health'],
  },
  {
    title: 'What To Do Next',
    subtitle: "Actions ordered by what this cycle's data says will compound fastest.",
    kinds: ['recommendations', 'roadmap'],
  },
  {
    title: 'Methodology & Privacy',
    subtitle: 'Every source behind this report, and the limits of what it can claim.',
    kinds: ['methodology'],
  },
];

const SECTION_TITLES: Partial<Record<SectionKind, string>> = {
  executive_snapshot: 'Executive Snapshot & Key Signals',
  market_position: 'Market Position & Benchmark Percentiles',
  pricing_intelligence: 'Pricing Intelligence',
  competitor_tracking: 'Marketplace & Competitor Tracking',
  sku_performance: 'SKU Performance',
  inventory_risk: 'Inventory & Demand Risk',
  portfolio_contribution: 'Product Portfolio Contribution',
  customer_health: 'Customer Health & Retention',
  recommendations: 'Prioritised Recommendations',
  roadmap: 'Strategic Action Roadmap',
  methodology: 'Methodology, Privacy & Data Sources',
  appendix: 'Appendix',
};

/** Order candidate sections appear in the TOC and the deck. */
const SECTION_ORDER: SectionKind[] = [
  'executive_snapshot',
  'market_position',
  'pricing_intelligence',
  'competitor_tracking',
  'sku_performance',
  'portfolio_contribution',
  'inventory_risk',
  'customer_health',
  'recommendations',
  'roadmap',
];

function paginate(kind: SectionKind, title: string, totalRows: number): PlannedSection[] {
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

/**
 * Every section is either fully present (its inclusion rule passed) or fully
 * absent (omitted, with a recorded reason) - there is no third state where a
 * section renders with a misleading zero or empty value. Total deck length
 * is a pure function of this plan, never a fixed number.
 */
export function buildSectionPlan(snapshot: ReportSnapshot): SectionPlan {
  const omitted: SectionPlan['omitted'] = [];
  const omit = (kind: SectionKind, reason: string) => omitted.push({ kind, reason });
  const content: PlannedSection[] = [];

  const push = (kind: SectionKind, pages?: PlannedSection[]) => {
    content.push(...(pages ?? [{ kind, title: SECTION_TITLES[kind] ?? kind, page: 0, pageCount: 1 }]));
  };

  if (snapshot.revenue != null || snapshot.productPerformance != null) {
    push('executive_snapshot');
  } else {
    omit('executive_snapshot', 'No revenue or product data available for this period.');
  }

  if (snapshot.marketplacePerformance) {
    push('market_position');
  } else {
    omit('market_position', 'No market-definition coverage for this category.');
  }

  if (snapshot.pricePositioning) {
    push('pricing_intelligence');
  } else {
    omit('pricing_intelligence', 'No price positioning data available.');
  }

  if (snapshot.competitorBenchmarks && snapshot.competitorBenchmarks.scorecards.length > 0) {
    push(
      'competitor_tracking',
      paginate('competitor_tracking', SECTION_TITLES.competitor_tracking!, snapshot.competitorBenchmarks.scorecards.length),
    );
  } else {
    omit('competitor_tracking', 'No named-seller source covers this category (only Daraz names sellers today).');
  }

  if (snapshot.productPerformance && snapshot.productPerformance.topProducts.length > 0) {
    push('sku_performance', paginate('sku_performance', SECTION_TITLES.sku_performance!, snapshot.productPerformance.topProducts.length));
  } else {
    omit('sku_performance', 'No active products.');
  }

  if (snapshot.productPerformance && snapshot.productPerformance.categoryBreakdown.length >= 2) {
    push('portfolio_contribution');
  } else {
    omit('portfolio_contribution', 'Fewer than 2 categories - no portfolio framing to show.');
  }

  // Defense-in-depth: collectors/revenue-and-products.ts already returns null
  // (not a 0-count object) when there is nothing to flag, but the planner
  // checks the actual count too rather than trusting object-existence alone.
  if (snapshot.inventoryRisk && snapshot.inventoryRisk.lowStockSkuCount > 0) {
    push('inventory_risk');
  } else {
    omit('inventory_risk', 'No SKUs below the low-stock threshold and no supply-void signals - a healthy state, not a section.');
  }

  if (snapshot.customerHealth) {
    push('customer_health');
  } else {
    omit('customer_health', 'Below minimum customer count for reliable retention scoring.');
  }

  if (snapshot.recommendations.length > 0) {
    push('recommendations');
  } else {
    omit('recommendations', 'No actionable recommendations generated this period.');
  }

  if (snapshot.strategicRoadmap && snapshot.strategicRoadmap.length >= 2) {
    push('roadmap');
  } else {
    omit('roadmap', 'Fewer than 2 recommendations - not enough to sequence into phases.');
  }

  const includedKinds = new Set(content.map((s) => s.kind));
  const includedSectionCount = includedKinds.size;
  const useChapters = includedSectionCount >= MIN_SECTIONS_FOR_CHAPTERS;

  // Chapters that actually have content, numbered contiguously - a chapter
  // with every section omitted never gets a divider announcing an empty run.
  const liveChapters = CHAPTERS.filter(
    (c) => c.kinds.some((k) => includedKinds.has(k)) || c.kinds.includes('methodology'),
  );

  const sections: PlannedSection[] = [{ kind: 'cover', title: 'Cover', page: 0, pageCount: 1 }];

  const toc: TocEntry[] = buildToc(SECTION_ORDER, includedKinds, omitted);
  if (useChapters) {
    sections.push({ kind: 'toc', title: "What's in this report", page: 0, pageCount: 1 });
  }

  const methodologyPage: PlannedSection = {
    kind: 'methodology',
    title: SECTION_TITLES.methodology!,
    page: 0,
    pageCount: 1,
  };

  if (useChapters) {
    liveChapters.forEach((chapter, i) => {
      const chapterNumber = i + 1;
      const pages = chapter.kinds.includes('methodology')
        ? [methodologyPage]
        : content.filter((s) => chapter.kinds.includes(s.kind));
      if (pages.length === 0) return;
      sections.push({
        kind: 'section_divider',
        title: chapter.title,
        page: 0,
        pageCount: 1,
        chapterNumber,
        chapterTotal: liveChapters.length,
        dividerSubtitle: chapter.subtitle,
        dividerStats: dividerStatsFor(chapter.kinds, snapshot),
      });
      sections.push(...pages.map((p) => ({ ...p, chapterNumber, chapterTotal: liveChapters.length })));
    });
  } else {
    sections.push(...content, methodologyPage);
  }

  if (snapshot.metadata.mode === 'internal' && appendixEntries(snapshot.appendix).length > 0) {
    sections.push({ kind: 'appendix', title: SECTION_TITLES.appendix!, page: 0, pageCount: 1 });
  }

  return {
    sections,
    totalPageCount: sections.length,
    omitted,
    toc,
    includedSectionCount,
    candidateSectionCount: SECTION_ORDER.length,
  };
}

function buildToc(
  order: SectionKind[],
  includedKinds: Set<SectionKind>,
  omitted: SectionPlan['omitted'],
): TocEntry[] {
  const omittedReasons = new Map(omitted.map((o) => [o.kind, o.reason]));
  let n = 0;
  return order.map((kind) => {
    if (includedKinds.has(kind)) {
      n += 1;
      return { number: n, title: SECTION_TITLES[kind] ?? kind, status: 'included' as const };
    }
    const reason = omittedReasons.get(kind) ?? '';
    // "Omitted" means a deliberate editorial choice (e.g. single-category
    // seller); "not enough data" means the source simply had nothing. Both
    // are shown, greyed - a reader deserves to know what was considered.
    const deliberate = /Fewer than|healthy state/i.test(reason);
    return {
      number: null,
      title: SECTION_TITLES[kind] ?? kind,
      status: deliberate ? ('omitted' as const) : ('not_enough_data' as const),
    };
  });
}

function dividerStatsFor(kinds: SectionKind[], snapshot: ReportSnapshot): { label: string; value: string }[] {
  const stats: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null) => {
    if (value != null) stats.push({ label, value });
  };

  if (kinds.includes('executive_snapshot') && snapshot.revenue) {
    add('Orders this period', String(Math.round(snapshot.revenue.orders.current)));
    if (snapshot.revenue.revenue.changePct != null) {
      add(
        'Revenue change',
        `${snapshot.revenue.revenue.changePct >= 0 ? '+' : ''}${snapshot.revenue.revenue.changePct.toFixed(1)}%`,
      );
    } else {
      // A brand-new seller has no prior period to diff against - showing a
      // fabricated "+0%" would be a lie, so this falls back to a snapshot
      // value rather than a delta. avgOrderValue.current always exists
      // (GrowthMetric.current is non-optional), unlike changePct.
      add(
        'Avg order value',
        formatCurrency(snapshot.revenue.avgOrderValue.current, snapshot.workspace.reportingCurrency),
      );
    }
  }
  if (kinds.includes('market_position') && snapshot.marketplacePerformance?.priceIndex) {
    add('Price index', snapshot.marketplacePerformance.priceIndex.value.toFixed(0));
    add('Platforms tracked', String(snapshot.marketplacePerformance.scope.platformNames.length));
  }
  if (kinds.includes('competitor_tracking') && snapshot.competitorBenchmarks) {
    add('Competitors tracked', String(snapshot.competitorBenchmarks.scorecards.length));
    // Distinct platforms among the tracked competitors, not a second copy of
    // the same count - this and market_position's own "Platforms tracked"
    // above are deliberately the same label for the same kind of fact.
    add(
      'Platforms tracked',
      String(new Set(snapshot.competitorBenchmarks.scorecards.map((s) => s.platformName)).size),
    );
  }
  if (kinds.includes('sku_performance') && snapshot.productPerformance) {
    add('Active products', String(snapshot.productPerformance.activeProductCount));
    add('Products ranked', String(snapshot.productPerformance.topProducts.length));
  }
  if (kinds.includes('inventory_risk') && snapshot.inventoryRisk) {
    add('SKUs at risk', String(snapshot.inventoryRisk.lowStockSkuCount));
    // A genuinely different number from lowStockSkuCount, not a restatement
    // of it - competitor stockouts overlapping this seller's own catalogue.
    add('Supply-void openings', String(snapshot.inventoryRisk.supplyVoidOpportunities?.length ?? 0));
  }
  if (kinds.includes('customer_health') && snapshot.customerHealth) {
    add('At-risk customers', String(snapshot.customerHealth.atRiskCount ?? 0));
    add(
      'Repeat purchase rate',
      snapshot.customerHealth.repeatPurchaseRate != null
        ? `${snapshot.customerHealth.repeatPurchaseRate.toFixed(1)}%`
        : null,
    );
  }
  if (kinds.includes('recommendations')) {
    add('Actions', String(snapshot.recommendations.length));
    add('Signals detected', String(snapshot.marketSignals.length));
  }
  if (kinds.includes('methodology')) {
    add('Data sources', String(snapshot.methodology.dataSources.length));
    add('Stated limitations', String(snapshot.methodology.limitations.length));
  }

  return stats.slice(0, 3);
}
