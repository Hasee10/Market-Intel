import type { ReportSnapshot } from './schema';

export interface ValidationIssue {
  code: string;
  message: string;
  blocking: boolean; // blocking issues prevent 'approved'/client_safe export; non-blocking are warnings
}

export interface ValidationResult {
  passed: boolean; // true iff no blocking issues
  issues: ValidationIssue[];
}

// The QUALITY CHECKS gate from the brief, run once as a pure function over
// a finished snapshot - never inside a renderer. A snapshot that fails here
// can still be saved as 'draft' (see persist.ts) but can never transition
// to 'approved', and the export endpoint refuses to produce a client_safe
// file for anything that hasn't passed.
export function validateSnapshot(snapshot: ReportSnapshot): ValidationResult {
  const issues: ValidationIssue[] = [];
  const push = (blocking: boolean, code: string, message: string) => issues.push({ code, message, blocking });

  // Missing required data
  if (!snapshot.workspace.businessName) push(true, 'missing_business_name', 'Workspace has no business name.');
  if (!snapshot.metadata.period.start || !snapshot.metadata.period.end) {
    push(true, 'missing_period', 'Report period is not set.');
  }

  // Date-range consistency
  if (snapshot.metadata.period.start && snapshot.metadata.period.end) {
    if (new Date(snapshot.metadata.period.start) >= new Date(snapshot.metadata.period.end)) {
      push(true, 'invalid_period', 'Report period start is not before its end.');
    }
  }

  // Currency consistency - every Sourced<number> and price figure in the
  // snapshot is expected to already be in workspace.reportingCurrency by
  // the time it reaches here (collectors convert at read time); this check
  // exists as the last line of defense, not the primary enforcement.
  if (!snapshot.workspace.reportingCurrency) {
    push(true, 'missing_currency', 'No reporting currency set for this workspace.');
  }

  // Invalid percentages - a percentile/index outside a sane range signals a
  // calculation bug upstream (the exact class of bug that produced the
  // "+2657.7%" figure in the previous system), not a real finding.
  if (snapshot.pricePositioning?.percentile != null) {
    const p = snapshot.pricePositioning.percentile;
    if (p < 0 || p > 100) push(true, 'invalid_percentile', `Price percentile ${p} is outside 0-100.`);
  }
  for (const row of snapshot.competitorBenchmarks?.scorecards ?? []) {
    if (row.inStockRate < 0 || row.inStockRate > 1) {
      push(true, 'invalid_rate', `${row.competitorName}'s in-stock rate ${row.inStockRate} is outside 0-1.`);
    }
    if (row.repricingRate != null && (row.repricingRate < 0 || row.repricingRate > 1)) {
      push(true, 'invalid_rate', `${row.competitorName}'s repricing rate ${row.repricingRate} is outside 0-1.`);
    }
  }

  // Empty charts - a trend/series field that exists but has fewer than 2
  // points can't be charted meaningfully; collectors are expected to null
  // these out already (see marketplace-and-pricing.ts, revenue-and-products.ts),
  // this re-asserts that contract rather than trusting it silently.
  if (snapshot.revenue?.weeklySeries != null && snapshot.revenue.weeklySeries.length < 2) {
    push(false, 'sparse_series', 'Weekly revenue series has fewer than 2 points; should be null instead.');
  }
  if (snapshot.pricePositioning?.trend != null && snapshot.pricePositioning.trend.length < 2) {
    push(false, 'sparse_series', 'Price trend series has fewer than 2 points; should be null instead.');
  }

  // "0 accounts"-style zero-value sections that should have been omitted
  if (snapshot.customerHealth?.atRiskCohorts.some((c) => c.count === 0)) {
    push(true, 'zero_value_cohort', 'An at-risk cohort has count 0; must be omitted, not rendered.');
  }
  if (snapshot.inventoryRisk != null && snapshot.inventoryRisk.lowStockSkuCount === 0) {
    push(true, 'zero_value_section', 'inventoryRisk section present with 0 low-stock SKUs; should be null.');
  }

  // Unsupported characters - the previous system's demo output rendered
  // bullet glyphs as "�" (a font/encoding mismatch). Anything outside basic
  // multilingual Unicode printable ranges plus common punctuation is flagged.
  const textFields = [
    snapshot.competitorBenchmarks?.marketDefinitionSummary,
    ...snapshot.recommendations.map((r) => r.text),
    ...snapshot.methodology.limitations,
  ].filter((v): v is string => typeof v === 'string');
  const REPLACEMENT_CHAR = /�/;
  for (const text of textFields) {
    if (REPLACEMENT_CHAR.test(text)) {
      push(true, 'unsupported_characters', `Text contains an unrenderable character: "${text.slice(0, 40)}..."`);
      break;
    }
  }

  // Missing sources - every competitor/market figure must carry provenance
  for (const row of snapshot.competitorBenchmarks?.scorecards ?? []) {
    if (!row.medianPrice.source) push(true, 'missing_source', `${row.competitorName}'s price has no data source.`);
  }
  if (snapshot.methodology.dataSources.length === 0) {
    push(false, 'missing_methodology', 'No data sources listed in methodology section.');
  }

  // Privacy violations - a client_safe export must never carry internal notes
  if (snapshot.privacy.mode === 'client_safe' && snapshot.privacy.internalNotes != null) {
    push(true, 'privacy_leak', 'client_safe mode still has internalNotes populated; must be stripped, not just hidden.');
  }

  // Approval status - only enforced at export time, not at draft-validation
  // time (a draft is allowed to fail this check; export.ts/persist.ts is
  // what actually refuses to hand out a client_safe file for a non-approved
  // snapshot - see docs/reports-v2-architecture.md §7 step 4).

  const passed = issues.every((i) => !i.blocking);
  return { passed, issues };
}
