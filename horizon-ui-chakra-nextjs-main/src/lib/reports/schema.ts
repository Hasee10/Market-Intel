// The single typed report data model - see docs/reports-v2-architecture.md
// §3. Every renderer (PPTX, PDF) and every collector/metric/rule module
// depends on this file; render/* must never define its own shape for
// report data, and collectors/* must never import from render/*.

export type DataSource = 'seller_private' | 'public_marketplace' | 'anonymized_cohort' | 'system_computed';

export interface Sourced<T> {
  value: T;
  source: DataSource;
  asOf: string;
}

export interface GrowthMetric {
  current: number;
  previous: number | null;
  changePct: number | null;
  changeAbs: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
}

export type ReportType = 'standard' | 'competitor_focus' | 'quarterly' | 'custom';
export type ReportStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'archived';
export type ReportMode = 'internal' | 'client_safe';

export interface ReportMetadata {
  reportId: string;
  reportType: ReportType;
  generatedAt: string;
  period: { start: string; end: string; label: string };
  comparisonPeriod: { start: string; end: string } | null;
  status: ReportStatus;
  mode: ReportMode;
  version: number;
}

export interface ReportWorkspace {
  sellerId: string;
  businessName: string;
  reportingCurrency: string;
  categories: { slug: string; name: string }[];
  planTier: 'free' | 'paid' | 'premium';
}

export interface RevenueSection {
  revenue: GrowthMetric;
  orders: GrowthMetric;
  avgOrderValue: GrowthMetric;
  weeklySeries: { label: string; value: number }[] | null;
}

export type ContributionBasis = 'revenue' | 'inventory_value';

export interface ProductPerformanceSection {
  activeProductCount: number;
  contributionBasis: ContributionBasis; // always 'inventory_value' until a
  // seller_order_items table exists - see docs/reports-v2-architecture.md §2 item 0.
  topProducts: { title: string; sku: string | null; contributionShare: number | null }[];
  categoryBreakdown: { category: string; value: number; share: number }[];
}

export interface MarketplacePerformanceSection {
  scope: { categorySlugs: string[]; platformNames: string[] };
  priceIndex: Sourced<number> | null; // seller median / market median * 100, null if either side is missing
  perPlatform: { platformName: string; skuOverlap: number; medianPriceGap: number | null }[];
}

export interface CompetitorScorecardRow {
  competitorName: string;
  platformName: string;
  skuCount: number;
  medianPrice: Sourced<number>;
  inStockRate: number;
  repricingRate: number | null;
}

export interface CompetitorBenchmarksSection {
  scorecards: CompetitorScorecardRow[];
  marketDefinitionSummary: string;
}

export interface PricePositioningSection {
  yourMedianPrice: Sourced<number>;
  marketMedian: Sourced<number>;
  percentile: number | null;
  recommendedBand: { low: number; high: number } | null;
  trend: { date: string; medianPrice: number }[] | null;
}

export interface InventoryRiskSection {
  lowStockSkuCount: number;
  stockoutRiskSkus: { title: string; sku: string | null; daysOfCoverEstimate: number | null }[];
  supplyVoidOpportunities: { competitorName: string; platformName: string; category: string }[] | null;
}

export interface CustomerHealthSection {
  retentionRate: GrowthMetric | null;
  repeatPurchaseRate: number | null;
  avgClv: Sourced<number> | null;
  atRiskCount: number | null;
  atRiskCohorts: { label: string; count: number; recoveryTargetPct: number | null }[];
}

export type MarketSignalKind = 'demand_rising' | 'supply_void' | 'price_war' | 'new_entrant';

export interface MarketSignal {
  signalId: string;
  kind: MarketSignalKind;
  ruleVersion: string;
  description: string;
  evidence: Sourced<unknown>;
}

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  text: string;
  basedOn: string[];
  aiGenerated: boolean;
}

export interface RoadmapPhase {
  phase: number;
  title: string;
  description: string;
}

export interface MethodologySection {
  dataSources: { name: string; type: DataSource; description: string }[];
  scrapeCoverage: { platformName: string; lastRunAt: string }[];
  limitations: string[];
}

export interface PrivacySection {
  mode: ReportMode;
  internalNotes: string[] | null;
  approval: {
    status: ReportStatus;
    reviewedBy: string | null;
    reviewedAt: string | null;
  };
}

export interface ReportSnapshot {
  schemaVersion: 1;
  metadata: ReportMetadata;
  workspace: ReportWorkspace;
  revenue: RevenueSection | null;
  productPerformance: ProductPerformanceSection | null;
  marketplacePerformance: MarketplacePerformanceSection | null;
  competitorBenchmarks: CompetitorBenchmarksSection | null;
  pricePositioning: PricePositioningSection | null;
  inventoryRisk: InventoryRiskSection | null;
  customerHealth: CustomerHealthSection | null;
  marketSignals: MarketSignal[];
  recommendations: Recommendation[];
  strategicRoadmap: RoadmapPhase[] | null;
  methodology: MethodologySection;
  privacy: PrivacySection;
  appendix: Record<string, unknown> | null;
}
