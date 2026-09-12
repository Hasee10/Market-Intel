// One-off script for visual-parity comparison against docs/report-reference/v3/New-Slides.pptx.
// Not part of the app - run with tsx, delete after use if not wanted.
import { writeFileSync } from 'fs';
import { buildReportDeck } from '../src/lib/reports/render/pptx/build-deck';
import { baseSnapshot } from '../src/lib/reports/test-fixtures';
import type { ReportSnapshot } from '../src/lib/reports/schema';

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
    scorecards: Array.from({ length: 14 }, (_, i) => ({
      competitorName: `Competitor ${i}`,
      platformName: 'Daraz',
      skuCount: 10,
      medianPrice: { value: 1000 + i, source: 'public_marketplace' as const, asOf: '2026-08-04' },
      inStockRate: 0.85,
      repricingRate: 0.15,
    })),
    marketDefinitionSummary: 'Daraz · 140 identified SKUs, 20 unattributed',
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
  marketSignals: [
    {
      signalId: 'sig-1',
      kind: 'price_war',
      ruleVersion: 'v1',
      description: 'Competitor 0 on Daraz repriced 30% of tracked SKUs this period.',
      evidence: { value: 0.3, source: 'public_marketplace', asOf: '2026-08-04' },
    },
  ],
  recommendations: [
    { id: 'r1', priority: 'high', text: 'Reorder low-stock items.', basedOn: [], aiGenerated: false },
    { id: 'r2', priority: 'medium', text: 'Review pricing against Competitor 0.', basedOn: ['sig-1'], aiGenerated: false },
  ],
  strategicRoadmap: [
    { phase: 1, title: 'Immediate action', description: 'Reorder low-stock items.' },
    { phase: 2, title: 'Ongoing optimisation', description: 'Review pricing against Competitor 0.' },
  ],
});

async function main() {
  const buffer = await buildReportDeck(richSnapshot);
  writeFileSync('/tmp/fresh-deck.pptx', buffer);
  console.log(`wrote /tmp/fresh-deck.pptx (${buffer.length} bytes)`);
}

main();
