import type {
  CompetitorBenchmarksSection,
  InventoryRiskSection,
  MarketSignal,
  PricePositioningSection,
} from '../schema';

// Named, versioned, deterministic rules - NOT the AI narration layer (see
// ai/narrate.ts). Promoted from the ad hoc ±5%/±1%/±0.5% thresholds that
// used to live inline inside collect-report-data.ts's getCompetitorTracking()
// with no name, no version, and no tests. Each rule here is a pure function
// over already-collected data; bump RULE_VERSION when a threshold changes so
// a stored snapshot's signals stay attributable to the rule that produced them.
const RULE_VERSION = 'v1';

let signalCounter = 0;
function nextId(kind: string): string {
  signalCounter += 1;
  return `${kind}-${signalCounter}`;
}

export function detectRepricingPressure(
  competitorBenchmarks: CompetitorBenchmarksSection | null,
  asOf: string,
): MarketSignal[] {
  if (!competitorBenchmarks) return [];
  const signals: MarketSignal[] = [];

  for (const row of competitorBenchmarks.scorecards) {
    if (row.repricingRate == null) continue;
    // >=30% of observed price checks moved for this competitor in the
    // lookback window - an aggressive repricer, worth flagging by name.
    if (row.repricingRate >= 0.3) {
      signals.push({
        signalId: nextId('price_war'),
        kind: 'price_war',
        ruleVersion: RULE_VERSION,
        description: `${row.competitorName} on ${row.platformName} repriced ${(row.repricingRate * 100).toFixed(0)}% of tracked SKUs this period.`,
        evidence: { value: row.repricingRate, source: 'public_marketplace', asOf },
      });
    }
  }

  return signals;
}

export function detectSupplyVoids(
  inventoryRisk: InventoryRiskSection | null,
  competitorBenchmarks: CompetitorBenchmarksSection | null,
  asOf: string,
): MarketSignal[] {
  if (!competitorBenchmarks) return [];
  const signals: MarketSignal[] = [];

  for (const row of competitorBenchmarks.scorecards) {
    // A tracked competitor with a meaningfully low in-stock rate across
    // their own assortment is a demand opportunity for a seller who is
    // stocked - only fires above a real sample size so one out-of-stock
    // SKU in a 2-SKU assortment doesn't read as a market-wide signal.
    if (row.skuCount >= 5 && row.inStockRate < 0.6) {
      signals.push({
        signalId: nextId('supply_void'),
        kind: 'supply_void',
        ruleVersion: RULE_VERSION,
        description: `${row.competitorName} on ${row.platformName} is out of stock on ${Math.round((1 - row.inStockRate) * 100)}% of their tracked assortment.`,
        evidence: { value: row.inStockRate, source: 'public_marketplace', asOf },
      });
    }
  }

  // Feeds inventoryRisk's own supplyVoidOpportunities field back for the
  // render layer's inventory section, sourced from the same signal pass
  // rather than a second ad hoc query.
  if (inventoryRisk) {
    inventoryRisk.supplyVoidOpportunities = signals
      .filter((s) => s.kind === 'supply_void')
      .slice(0, 5)
      .map((s) => {
        const match = /^(.+?) on (.+?) is/.exec(s.description);
        return {
          competitorName: match?.[1] ?? 'Unknown',
          platformName: match?.[2] ?? 'Unknown',
          category: '',
        };
      });
  }

  return signals;
}

export function detectPricePositionSignal(
  pricePositioning: PricePositioningSection | null,
  asOf: string,
): MarketSignal[] {
  if (!pricePositioning || pricePositioning.percentile == null) return [];

  // Above the 80th percentile on price, with no recommended band context
  // suggesting a premium-brand exception, reads as a demand risk - phrased
  // as "demand_rising" for competitors, not the seller, so this is framed
  // from the seller's own price-risk angle instead.
  if (pricePositioning.percentile >= 80) {
    return [
      {
        signalId: nextId('demand_rising'),
        kind: 'demand_rising',
        ruleVersion: RULE_VERSION,
        description: `Your price sits at the ${pricePositioning.percentile}th percentile of the tracked market - above most of the category.`,
        evidence: { value: pricePositioning.percentile, source: 'system_computed', asOf },
      },
    ];
  }

  return [];
}

export function detectNewEntrants(
  competitorBenchmarks: CompetitorBenchmarksSection | null,
  periodStart: string,
  asOf: string,
): MarketSignal[] {
  if (!competitorBenchmarks) return [];
  // firstSeenAt isn't carried on the trimmed CompetitorScorecardRow used in
  // the report schema (see collectors/competitors.ts) - this rule is a stub
  // until that field is threaded through, intentionally returning [] rather
  // than guessing. Left in place (not deleted) so the rule catalogue in
  // docs/reports-v2-architecture.md stays accurate to what's implemented.
  void periodStart;
  void asOf;
  return [];
}

export function runMarketSignalRules(
  competitorBenchmarks: CompetitorBenchmarksSection | null,
  inventoryRisk: InventoryRiskSection | null,
  pricePositioning: PricePositioningSection | null,
  periodStart: string,
  asOf: string,
): MarketSignal[] {
  return [
    ...detectRepricingPressure(competitorBenchmarks, asOf),
    ...detectSupplyVoids(inventoryRisk, competitorBenchmarks, asOf),
    ...detectPricePositionSignal(pricePositioning, asOf),
    ...detectNewEntrants(competitorBenchmarks, periodStart, asOf),
  ];
}
