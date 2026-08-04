import type { ReportSnapshot } from './schema';

// Shared minimal-valid fixture for tests across section-plan/validate/render
// - every test starts from this and overrides just the fields it's testing,
// rather than each test file hand-rolling its own partial snapshot.
export function baseSnapshot(overrides: Partial<ReportSnapshot> = {}): ReportSnapshot {
  const now = '2026-08-04T00:00:00.000Z';
  return {
    schemaVersion: 1,
    metadata: {
      reportId: 'test-report-id',
      reportType: 'standard',
      generatedAt: now,
      period: { start: '2026-07-05T00:00:00.000Z', end: now, label: 'Last 30 days' },
      comparisonPeriod: { start: '2026-06-05T00:00:00.000Z', end: '2026-07-05T00:00:00.000Z' },
      status: 'draft',
      mode: 'internal',
      version: 1,
    },
    workspace: {
      sellerId: 'seller-1',
      businessName: 'Test Seller',
      reportingCurrency: 'PKR',
      categories: [{ slug: 'mobiles-and-electronics', name: 'Mobiles & Electronics' }],
      planTier: 'paid',
    },
    revenue: null,
    productPerformance: null,
    marketplacePerformance: null,
    competitorBenchmarks: null,
    pricePositioning: null,
    inventoryRisk: null,
    customerHealth: null,
    marketSignals: [],
    recommendations: [],
    strategicRoadmap: null,
    methodology: {
      dataSources: [{ name: 'Your store data', type: 'seller_private', description: 'Orders and products from your account.' }],
      scrapeCoverage: [],
      limitations: [],
    },
    privacy: {
      mode: 'internal',
      internalNotes: [],
      approval: { status: 'draft', reviewedBy: null, reviewedAt: null },
    },
    appendix: null,
    ...overrides,
  };
}
