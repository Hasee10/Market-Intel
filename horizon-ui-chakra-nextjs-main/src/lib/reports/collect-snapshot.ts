'server-only';

import { randomUUID } from 'crypto';
import { getLatestFxRates } from '@/lib/market-intel/fx';
import { getPrimaryDomain, type Seller } from '@/lib/market-intel/seller';
import type { ReportSnapshot, ReportType, Recommendation, RoadmapPhase } from './schema';
import { collectRevenueAndProducts } from './collectors/revenue-and-products';
import { collectMarketplaceAndPricing } from './collectors/marketplace-and-pricing';
import { collectCompetitorBenchmarks } from './collectors/competitors';
import { collectCustomerHealth } from './collectors/customers';
import { runMarketSignalRules } from './rules/market-signals';
import { narrateReport } from './ai/narrate';

export interface CollectSnapshotOptions {
  reportType?: ReportType;
  lookbackDays?: number;
  mode?: 'internal' | 'client_safe';
}

export async function collectSnapshot(seller: Seller, options: CollectSnapshotOptions = {}): Promise<ReportSnapshot> {
  const lookbackDays = options.lookbackDays ?? 30;
  const now = new Date();
  const periodStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const previousPeriodStart = new Date(now.getTime() - lookbackDays * 2 * 24 * 60 * 60 * 1000).toISOString();
  const asOf = now.toISOString();
  const reportingCurrency = seller.reportingCurrency;

  const [domain, fxRates] = await Promise.all([getPrimaryDomain(seller.id), getLatestFxRates()]);

  const { revenue, productPerformance, inventoryRisk, avgSellPrice } = await collectRevenueAndProducts(
    seller,
    periodStart,
    previousPeriodStart,
    fxRates,
  );

  const [{ marketplacePerformance, pricePositioning }, competitorBenchmarks, customerHealth] = await Promise.all([
    collectMarketplaceAndPricing(domain?.categorySlug ?? null, avgSellPrice, reportingCurrency, fxRates, asOf),
    collectCompetitorBenchmarks(domain?.categorySlug ?? null, reportingCurrency, seller.id, asOf),
    collectCustomerHealth(seller.id, reportingCurrency, asOf),
  ]);

  const marketSignals = runMarketSignalRules(
    competitorBenchmarks,
    inventoryRisk,
    pricePositioning,
    periodStart,
    asOf,
  );

  const recommendations = buildRecommendations(marketSignals, inventoryRisk, pricePositioning);
  const strategicRoadmap = buildRoadmap(recommendations);

  const snapshot: ReportSnapshot = {
    schemaVersion: 1,
    metadata: {
      reportId: randomUUID(),
      reportType: options.reportType ?? 'standard',
      generatedAt: asOf,
      period: { start: periodStart, end: asOf, label: `Last ${lookbackDays} days` },
      comparisonPeriod: { start: previousPeriodStart, end: periodStart },
      status: 'draft',
      mode: options.mode ?? 'internal',
      version: 1,
    },
    workspace: {
      sellerId: seller.id,
      businessName: seller.businessName,
      reportingCurrency,
      categories: domain ? [{ slug: domain.categorySlug, name: domain.categoryName }] : [],
      planTier: seller.planTier as 'free' | 'paid' | 'premium',
    },
    revenue,
    productPerformance,
    marketplacePerformance,
    competitorBenchmarks,
    pricePositioning,
    inventoryRisk,
    customerHealth,
    marketSignals,
    recommendations,
    strategicRoadmap,
    methodology: buildMethodology(domain?.categorySlug ?? null, competitorBenchmarks != null),
    privacy: {
      mode: options.mode ?? 'internal',
      internalNotes: options.mode === 'client_safe' ? null : [],
      approval: { status: 'draft', reviewedBy: null, reviewedAt: null },
    },
    appendix: null,
  };

  const narration = await narrateReport(snapshot);
  if (narration.summary) {
    snapshot.appendix = { ...(snapshot.appendix ?? {}), aiSummary: narration.summary };
  }
  // AI highlights fold into recommendations as clearly-marked, non-numeric
  // narrative entries - never replacing the rule-derived, traceable ones.
  for (const highlight of narration.highlights) {
    recommendations.push({
      id: `ai-${recommendations.length}`,
      priority: 'low',
      text: highlight,
      basedOn: [],
      aiGenerated: true,
    });
  }

  return snapshot;
}

function buildRecommendations(
  signals: ReportSnapshot['marketSignals'],
  inventoryRisk: ReportSnapshot['inventoryRisk'],
  pricePositioning: ReportSnapshot['pricePositioning'],
): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const signal of signals) {
    if (signal.kind === 'supply_void') {
      recs.push({
        id: `rec-${signal.signalId}`,
        priority: 'medium',
        text: `Consider stocking up where ${signal.description.split(' is out of stock')[0]} has gone out of stock.`,
        basedOn: [signal.signalId],
        aiGenerated: false,
      });
    }
    if (signal.kind === 'price_war') {
      recs.push({
        id: `rec-${signal.signalId}`,
        priority: 'high',
        text: `Review pricing against ${signal.description.split(' on ')[0]} - they've been repricing aggressively.`,
        basedOn: [signal.signalId],
        aiGenerated: false,
      });
    }
  }

  if (inventoryRisk && inventoryRisk.lowStockSkuCount > 0) {
    recs.push({
      id: 'rec-low-stock',
      priority: 'high',
      text: `Reorder the ${Math.min(inventoryRisk.lowStockSkuCount, 5)} SKUs nearing your low-stock threshold.`,
      basedOn: [],
      aiGenerated: false,
    });
  }

  if (pricePositioning?.recommendedBand) {
    recs.push({
      id: 'rec-price-band',
      priority: 'medium',
      text: `Review pricing against the tracked market's typical range for this category.`,
      basedOn: [],
      aiGenerated: false,
    });
  }

  return recs;
}

function buildRoadmap(recommendations: Recommendation[]): RoadmapPhase[] | null {
  const ruleBasedRecs = recommendations.filter((r) => !r.aiGenerated);
  if (ruleBasedRecs.length < 2) return null;

  return ruleBasedRecs.slice(0, 4).map((r, i) => ({
    phase: i + 1,
    title: r.priority === 'high' ? 'Immediate action' : 'Ongoing optimisation',
    description: r.text,
  }));
}

function buildMethodology(categorySlug: string | null, hasCompetitorData: boolean): ReportSnapshot['methodology'] {
  const dataSources: ReportSnapshot['methodology']['dataSources'] = [
    { name: 'Your store data', type: 'seller_private', description: 'Orders, products and customers from your own account.' },
  ];
  if (categorySlug) {
    dataSources.push({
      name: 'Ryvl market scan',
      type: 'public_marketplace',
      description: 'Publicly listed prices and stock status scraped from tracked retailer marketplaces.',
    });
  }

  const limitations: string[] = [];
  if (hasCompetitorData) {
    limitations.push(
      'Repricing rate is a floor, not exhaustive - price moves that reverted between scheduled scrapes are not observed.',
    );
  }
  limitations.push('Product/portfolio contribution is based on inventory value, not recorded sales revenue.');

  return { dataSources, scrapeCoverage: [], limitations };
}
