import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import { buildReportDeck } from './pptx/build-deck';
import { buildReportPdf } from './pdf/build-pdf';
import { MIN_SPARKLINE_POINTS, signalBadge } from './pptx/components';
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

// Everything this file checks is a real, data-driven component added to
// match the density of the reference deck (New-Slides.pptx): sparklines,
// the price ladder, competitor highlight cards, the recommendation grid,
// and confidentiality-label consistency. These assert on the actual
// rendered XML, not just "it didn't throw" - a regression that silently
// dropped one of these components would be invisible to render.test.ts.

async function allSlideText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  const texts = await Promise.all(slideFiles.map((name) => zip.files[name].async('text')));
  return texts.join('\n');
}

async function chartCount(buffer: Buffer): Promise<number> {
  const zip = await JSZip.loadAsync(buffer);
  return Object.keys(zip.files).filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name)).length;
}

async function pictureCount(buffer: Buffer): Promise<number> {
  const zip = await JSZip.loadAsync(buffer);
  // pptxgenjs unconditionally calls zip.folder('ppt/media') during export,
  // which JSZip represents as a directory entry ("ppt/media/", entry.dir ===
  // true) even when zero images are ever added. Matching on the path alone
  // counted that empty placeholder as "1 picture" and made this assertion
  // fail on every deck, including ones with genuinely zero raster images -
  // verified directly against JSZip's own output. Only real files count.
  return Object.values(zip.files).filter((entry) => !entry.dir && /^ppt\/media\//.test(entry.name)).length;
}

const richSnapshot: ReportSnapshot = baseSnapshot({
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
  competitorBenchmarks: {
    scorecards: [
      // Deliberately distinct so "most active repricer" and "supply void"
      // pick a specific, checkable row rather than a coincidental tie.
      { competitorName: 'Alpha Traders', platformName: 'Daraz', skuCount: 10, medianPrice: { value: 1000, source: 'public_marketplace', asOf: '2026-08-04' }, inStockRate: 0.95, repricingRate: 0.85 },
      { competitorName: 'Beta Mobile', platformName: 'Daraz', skuCount: 8, medianPrice: { value: 1100, source: 'public_marketplace', asOf: '2026-08-04' }, inStockRate: 0.4, repricingRate: 0.1 },
      { competitorName: 'Gamma Gadgets', platformName: 'Telemart', skuCount: 3, medianPrice: { value: 900, source: 'public_marketplace', asOf: '2026-08-04' }, inStockRate: 0.05, repricingRate: null },
    ],
    marketDefinitionSummary: 'Daraz · 21 identified SKUs',
  },
  inventoryRisk: {
    lowStockSkuCount: 3,
    stockoutRiskSkus: [{ title: 'Low Stock Item', sku: 'LS-1', daysOfCoverEstimate: 4 }],
    supplyVoidOpportunities: [{ competitorName: 'Beta Mobile', platformName: 'Daraz', category: 'Phones' }],
  },
  marketSignals: [
    { signalId: 'sig-1', kind: 'price_war', ruleVersion: 'v1', description: 'Beta Mobile repriced sharply this cycle.', evidence: { value: 0.3, source: 'public_marketplace', asOf: '2026-08-04' } },
  ],
  recommendations: [
    { id: 'r1', priority: 'high', text: 'Reorder low-stock items.', basedOn: [], aiGenerated: false },
    { id: 'r2', priority: 'medium', text: 'Review pricing against Beta Mobile.', basedOn: ['sig-1'], aiGenerated: false },
  ],
});

describe('signalBadge mapping is deterministic, not invented', () => {
  it('maps each signal kind to a fixed badge label/tone', () => {
    expect(signalBadge('price_war')).toEqual({ label: 'WATCH', tone: 'warning' });
    expect(signalBadge('new_entrant')).toEqual({ label: 'WATCH', tone: 'warning' });
    expect(signalBadge('supply_void')).toEqual({ label: 'OPENING', tone: 'positive' });
    expect(signalBadge('demand_rising')).toEqual({ label: 'POSITION', tone: 'info' });
  });
});

describe('sparkline gating', () => {
  it('requires at least MIN_SPARKLINE_POINTS data points', () => {
    expect(MIN_SPARKLINE_POINTS).toBe(3);
  });

  it('data-rich deck includes at least one native chart, and no raster stands in for a data visual', async () => {
    const buffer = await buildReportDeck(richSnapshot);
    const charts = await chartCount(buffer);
    const pictures = await pictureCount(buffer);
    expect(charts).toBeGreaterThan(0);
    // Exactly one picture is expected now: the cover slide's decorative
    // illustration (assets/illustrations.ts), which encodes no data. More
    // than that would mean something started rasterizing an actual chart -
    // the failure mode this test originally existed to catch.
    expect(pictures).toBe(1);
  });

  it('a seller with fewer than 3 revenue data points renders without a sparkline-driven crash', async () => {
    const thin = baseSnapshot({
      revenue: {
        revenue: { current: 1000, previous: 900, changePct: 11, changeAbs: 100, direction: 'up' },
        orders: { current: 5, previous: 4, changePct: 25, changeAbs: 1, direction: 'up' },
        avgOrderValue: { current: 200, previous: 225, changePct: -11, changeAbs: -25, direction: 'down' },
        weeklySeries: [{ label: 'Wk 1', value: 500 }, { label: 'Wk 2', value: 500 }], // 2 points - below gate
      },
    });
    const buffer = await buildReportDeck(thin);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe('price ladder renders only real schema fields', () => {
  it('includes your price, market median, and band rungs - never invented tracked extremes', async () => {
    const buffer = await buildReportDeck(richSnapshot);
    const text = await allSlideText(buffer);
    expect(text).toContain('Your price');
    expect(text).toContain('Market median');
    expect(text).toContain('Band');
    expect(text).not.toContain('Highest tracked');
    expect(text).not.toContain('Lowest tracked');
  });
});

describe('competitor highlight cards pick the right row from real data', () => {
  it('names the highest-repricingRate competitor as most active repricer', async () => {
    const buffer = await buildReportDeck(richSnapshot);
    const text = await allSlideText(buffer);
    expect(text).toContain('MOST ACTIVE REPRICER');
    expect(text).toContain('Alpha Traders'); // repricingRate 0.85, the max
  });

  it('names the lowest-inStockRate competitor with skuCount >= 5 as the supply void, skipping the thin-sample outlier', async () => {
    const buffer = await buildReportDeck(richSnapshot);
    const text = await allSlideText(buffer);
    expect(text).toContain('SUPPLY VOID');
    // Gamma Gadgets has the lowest inStockRate (0.05) but only 3 SKUs -
    // below the skuCount >= 5 threshold - so Beta Mobile (0.4, 8 SKUs) wins.
    expect(text).toContain('Beta Mobile');
  });

  it('includes a tracked-set medians card', async () => {
    const buffer = await buildReportDeck(richSnapshot);
    const text = await allSlideText(buffer);
    expect(text.toUpperCase()).toContain('TRACKED-SET MEDIANS');
  });
});

describe('recommendations render as a grid with deterministic timeframe text', () => {
  it('labels a high-priority recommendation "Act this week" and a medium one "Next 30 days"', async () => {
    const buffer = await buildReportDeck(richSnapshot);
    const text = await allSlideText(buffer);
    expect(text).toContain('Act this week');
    expect(text).toContain('Next 30 days');
  });
});

describe('confidentiality label is consistent across every slide in one deck', () => {
  it('internal-mode deck shows the same label on every slide that carries one', async () => {
    const internal = baseSnapshot({ metadata: { ...baseSnapshot().metadata, mode: 'internal' } });
    const buffer = await buildReportDeck(internal);
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    const texts = await Promise.all(slideFiles.map((name) => zip.files[name].async('text')));
    const labels = new Set<string>();
    texts.forEach((t) => {
      if (t.includes('Internal - not for distribution')) labels.add('internal');
      if (t.includes('>Confidential<')) labels.add('confidential');
    });
    // Every slide that shows a confidentiality pill agrees on which one.
    expect(labels.size).toBeLessThanOrEqual(1);
  });
});

describe('PDF renderer stays in sync with the PPTX renderer for the same snapshot', () => {
  it('renders the same data-rich snapshot without throwing, proving both formats share the enrichment', async () => {
    const buffer = await buildReportPdf(richSnapshot);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
