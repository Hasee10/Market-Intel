import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import { buildReportDeck } from './pptx/build-deck';
import { buildSectionPlan } from '../section-plan';
import { baseSnapshot } from '../test-fixtures';
import type { ReportSnapshot } from '../schema';

// These renderers do real document generation - pdfkit lays out every page
// and embeds .afm font metrics read from disk, pptxgenjs zips a full OOXML
// container - and they are genuinely slow. The data-rich cases have been
// measured anywhere from 1.1s to over 5s on the same machine depending on
// what else is running, which put them right on vitest's 5s default: the
// data-rich PDF case failed intermittently with "Test timed out in 5000ms"
// while testing nothing about whatever change was in flight. None of these
// are performance assertions - they only check the renderers produce a
// valid container without throwing - so the ceiling is set high enough that
// only a real hang trips it.
vi.setConfig({ testTimeout: 30_000 });

// This is the direct proof for "is the PPTX's dynamic nature actually
// assured" - not a description of the design, but an end-to-end check that
// three genuinely different sellers produce three genuinely different
// slide counts from the SAME renderer, with no fixed template and no
// hardcoded slide array anywhere. A regression here (e.g. someone padding
// the deck to a fixed length, or a section rendering regardless of data)
// would fail this test immediately.
async function countRealSlides(buffer: Buffer): Promise<number> {
  const zip = await JSZip.loadAsync(buffer);
  return Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length;
}

const thinSeller = baseSnapshot(); // no revenue, no products, no market data at all

const midSeller: ReportSnapshot = baseSnapshot({
  revenue: {
    revenue: { current: 300000, previous: 250000, changePct: 20, changeAbs: 50000, direction: 'up' },
    orders: { current: 60, previous: 50, changePct: 20, changeAbs: 10, direction: 'up' },
    avgOrderValue: { current: 5000, previous: 5000, changePct: 0, changeAbs: 0, direction: 'flat' },
    weeklySeries: [1, 2, 3, 4, 5, 6].map((i) => ({ label: `Wk ${i}`, value: i * 500 })),
  },
  productPerformance: {
    activeProductCount: 8,
    contributionBasis: 'inventory_value',
    topProducts: Array.from({ length: 3 }, (_, i) => ({ title: `Product ${i}`, sku: `SKU-${i}`, contributionShare: 0.33 })),
    categoryBreakdown: [{ category: 'Electronics', value: 100000, share: 1 }], // single category - portfolio section should stay omitted
  },
});

const richSeller: ReportSnapshot = baseSnapshot({
  revenue: {
    revenue: { current: 500000, previous: 400000, changePct: 25, changeAbs: 100000, direction: 'up' },
    orders: { current: 120, previous: 100, changePct: 20, changeAbs: 20, direction: 'up' },
    avgOrderValue: { current: 4166, previous: 4000, changePct: 4.16, changeAbs: 166, direction: 'up' },
    weeklySeries: [1, 2, 3, 4, 5, 6].map((i) => ({ label: `Wk ${i}`, value: i * 1000 })),
  },
  productPerformance: {
    activeProductCount: 20,
    contributionBasis: 'inventory_value',
    topProducts: Array.from({ length: 5 }, (_, i) => ({ title: `Product ${i}`, sku: `SKU-${i}`, contributionShare: 0.2 })),
    categoryBreakdown: [
      { category: 'Phones', value: 60000, share: 0.6 },
      { category: 'Accessories', value: 40000, share: 0.4 },
    ],
  },
  marketplacePerformance: {
    scope: { categorySlugs: ['mobiles-and-electronics'], platformNames: ['Daraz', 'Telemart'] },
    priceIndex: { value: 104, source: 'public_marketplace', asOf: '2026-08-04' },
    perPlatform: [],
  },
  pricePositioning: {
    yourMedianPrice: { value: 25000, source: 'seller_private', asOf: '2026-08-04' },
    marketMedian: { value: 24000, source: 'public_marketplace', asOf: '2026-08-04' },
    percentile: 62,
    recommendedBand: { low: 23000, high: 26000 },
    trend: Array.from({ length: 6 }, (_, i) => ({ date: `2026-07-0${i + 1}`, medianPrice: 24000 + i * 100 })),
  },
  // 40 competitors deliberately - forces the pagination ceiling to kick in
  competitorBenchmarks: {
    scorecards: Array.from({ length: 40 }, (_, i) => ({
      competitorName: `Competitor ${i}`,
      platformName: 'Daraz',
      skuCount: 10,
      medianPrice: { value: 1000 + i, source: 'public_marketplace' as const, asOf: '2026-08-04' },
      inStockRate: 0.85,
      repricingRate: 0.15,
    })),
    marketDefinitionSummary: 'Daraz · 400 identified SKUs, 60 unattributed',
  },
  inventoryRisk: {
    lowStockSkuCount: 3,
    stockoutRiskSkus: [{ title: 'Low Stock Item', sku: 'LS-1', daysOfCoverEstimate: null }],
    supplyVoidOpportunities: [{ competitorName: 'Competitor 0', platformName: 'Daraz', category: 'Phones' }],
  },
  customerHealth: {
    retentionRate: { current: 62, previous: 58, changePct: 6.9, changeAbs: 4, direction: 'up' },
    repeatPurchaseRate: 34,
    avgClv: { value: 8200, source: 'seller_private', asOf: '2026-08-04' },
    atRiskCount: 12,
    atRiskCohorts: [{ label: 'At-risk customers', count: 12, recoveryTargetPct: null }],
  },
  recommendations: [
    { id: 'r1', priority: 'high', text: 'Reorder low-stock items.', basedOn: [], aiGenerated: false },
    { id: 'r2', priority: 'medium', text: 'Review pricing against Competitor 0.', basedOn: [], aiGenerated: false },
  ],
  strategicRoadmap: [
    { phase: 1, title: 'Immediate action', description: 'Reorder low-stock items.' },
    { phase: 2, title: 'Ongoing optimisation', description: 'Review pricing against Competitor 0.' },
  ],
});

describe('PPTX slide count is genuinely dynamic, not fixed', () => {
  it('produces three different real slide counts for three different sellers from the same renderer', async () => {
    const [thinBuf, midBuf, richBuf] = await Promise.all([
      buildReportDeck(thinSeller),
      buildReportDeck(midSeller),
      buildReportDeck(richSeller),
    ]);

    const [thinCount, midCount, richCount] = await Promise.all([
      countRealSlides(thinBuf),
      countRealSlides(midBuf),
      countRealSlides(richBuf),
    ]);

    // Every count must match what section-plan.ts itself computed - proves
    // the renderer isn't emitting some other fixed number under the hood.
    expect(thinCount).toBe(buildSectionPlan(thinSeller).totalPageCount);
    expect(midCount).toBe(buildSectionPlan(midSeller).totalPageCount);
    expect(richCount).toBe(buildSectionPlan(richSeller).totalPageCount);

    // The actual proof: three distinct, ascending counts, not one fixed number.
    expect(thinCount).toBeLessThan(midCount);
    expect(midCount).toBeLessThan(richCount);

    // Concrete floor: a data-free seller gets exactly cover + methodology.
    expect(thinCount).toBe(2);

    // Concrete ceiling proof: 40 competitors never produces 40/5=8 slides -
    // MAX_CONTINUATION_PAGES is 0 (matching the reference deck, which never
    // continues this table onto a second slide - see section-plan.ts's
    // comment on the constant), so this is always exactly 1 slide, truncated.
    const richPlan = buildSectionPlan(richSeller);
    const competitorSlides = richPlan.sections.filter((s) => s.kind === 'competitor_tracking');
    expect(competitorSlides.length).toBe(1);
    expect(competitorSlides[competitorSlides.length - 1].truncated).toBe(true);
  });

  it('adds contents + chapter dividers only when the report is substantial enough to need them', () => {
    // Thin and mid reports skip both - a 2-to-4 slide deck does not need a
    // contents page or chapter breaks, and adding them would be padding.
    for (const sparse of [thinSeller, midSeller]) {
      const kinds = buildSectionPlan(sparse).sections.map((s) => s.kind);
      expect(kinds).not.toContain('toc');
      expect(kinds).not.toContain('section_divider');
    }

    const richPlan = buildSectionPlan(richSeller);
    const kinds = richPlan.sections.map((s) => s.kind);
    expect(kinds[0]).toBe('cover');
    expect(kinds[1]).toBe('toc');
    expect(kinds.filter((k) => k === 'section_divider').length).toBeGreaterThanOrEqual(4);

    // Every divider is immediately followed by real content, never another
    // divider or the end of the deck - i.e. no chapter is announced empty.
    kinds.forEach((kind, i) => {
      if (kind !== 'section_divider') return;
      expect(kinds[i + 1]).toBeDefined();
      expect(kinds[i + 1]).not.toBe('section_divider');
    });

    // Dividers carry their own chapter numbering, contiguous from 1.
    const dividers = richPlan.sections.filter((s) => s.kind === 'section_divider');
    dividers.forEach((d, i) => {
      expect(d.chapterNumber).toBe(i + 1);
      expect(d.chapterTotal).toBe(dividers.length);
    });
  });

  it('table of contents reflects real inclusion, listing omitted sections rather than hiding them', () => {
    const plan = buildSectionPlan(richSeller);
    expect(plan.toc.length).toBe(plan.candidateSectionCount);

    const included = plan.toc.filter((e) => e.status === 'included');
    expect(included.length).toBe(plan.includedSectionCount);
    // Included entries are numbered contiguously from 1; excluded ones carry
    // no number at all rather than a misleading placeholder index.
    included.forEach((entry, i) => expect(entry.number).toBe(i + 1));
    plan.toc.filter((e) => e.status !== 'included').forEach((e) => expect(e.number).toBeNull());

    // A seller missing everything still gets an honest contents list where
    // every candidate section is accounted for as absent, not silently dropped.
    const thinToc = buildSectionPlan(thinSeller).toc;
    expect(thinToc.every((e) => e.status !== 'included')).toBe(true);
    expect(thinToc.length).toBe(plan.candidateSectionCount);
  });

  it('never renders a fixed template count regardless of how sparse the data is', async () => {
    // Two different thin sellers with completely different business names/
    // ids should still both produce the same minimal count (2), proving
    // the floor is driven by data availability, not seller identity.
    const sellerA = baseSnapshot({ workspace: { ...baseSnapshot().workspace, sellerId: 'a', businessName: 'Seller A' } });
    const sellerB = baseSnapshot({ workspace: { ...baseSnapshot().workspace, sellerId: 'b', businessName: 'Totally Different Seller B Inc.' } });

    const [bufA, bufB] = await Promise.all([buildReportDeck(sellerA), buildReportDeck(sellerB)]);
    const [countA, countB] = await Promise.all([countRealSlides(bufA), countRealSlides(bufB)]);

    expect(countA).toBe(2);
    expect(countB).toBe(2);
  });
});
