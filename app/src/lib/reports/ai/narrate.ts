'server-only';

import { callGroqJson } from '@/lib/ai/groq-client';
import type { GrowthMetric, ReportSnapshot, Sourced } from '../schema';
import { formatCurrency } from '../design-tokens';

export interface NarrationResult {
  summary: string;
  highlights: string[];
  recommendedActions: string[];
  rejected: boolean; // true if the AI response failed the numeric-consistency check and the fallback was used
}

const FALLBACK: Omit<NarrationResult, 'rejected'> = {
  summary: 'This report summarizes recent performance, market position, and customer retention from the seller\'s own data and tracked marketplace signals.',
  highlights: [],
  recommendedActions: [],
};

// Returns a string, never null - the `| null` this used to declare was
// vestigial (the body has no branch that returns it) and only forced callers
// to handle a case that cannot happen. sourcedLine below genuinely can return
// null, and keeps it.
function growthLine(label: string, m: GrowthMetric, currency?: string): string {
  const fmt = (v: number) => (currency ? formatCurrency(v, currency) : v.toFixed(1));
  const pct = m.changePct != null ? ` (${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(1)}% vs. prior period)` : '';
  return `${label}: ${fmt(m.current)}${pct}`;
}

function sourcedLine(label: string, s: Sourced<number> | null, currency?: string): string | null {
  if (!s) return null;
  const fmt = (v: number) => (currency ? formatCurrency(v, currency) : v.toFixed(1));
  return `${label}: ${fmt(s.value)}`;
}

// Every number the model could plausibly cite, flattened for the
// consistency check below. Anything the model states that isn't
// (approximately) one of these gets treated as an unverifiable claim.
function collectNumericGround(snapshot: ReportSnapshot): number[] {
  const nums: number[] = [];
  const push = (v: number | null | undefined) => {
    if (v != null && Number.isFinite(v)) nums.push(Math.round(v * 10) / 10);
  };
  const pushGrowth = (m: GrowthMetric | null | undefined) => {
    if (!m) return;
    push(m.current);
    push(m.previous);
    push(m.changePct);
  };

  pushGrowth(snapshot.revenue?.revenue);
  pushGrowth(snapshot.revenue?.orders);
  pushGrowth(snapshot.revenue?.avgOrderValue);
  pushGrowth(snapshot.revenue?.returns?.returnRate);
  pushGrowth(snapshot.revenue?.returns?.cancelRate);
  pushGrowth(snapshot.revenue?.returns?.refundValue);
  push(snapshot.revenue?.returns?.refundedOrders);
  push(snapshot.revenue?.returns?.cancelledOrders);
  push(snapshot.productPerformance?.activeProductCount);
  push(snapshot.inventoryRisk?.lowStockSkuCount);
  push(snapshot.marketplacePerformance?.priceIndex?.value);
  push(snapshot.marketplacePerformance?.listingShare?.value.value);
  push(snapshot.marketplacePerformance?.listingShare?.sellerListings);
  push(snapshot.marketplacePerformance?.listingShare?.marketListings);
  push(snapshot.pricePositioning?.percentile);
  push(snapshot.customerHealth?.repeatPurchaseRate);
  push(snapshot.customerHealth?.atRiskCount);
  pushGrowth(snapshot.customerHealth?.repeatBuyers?.repeatShare);
  pushGrowth(snapshot.customerHealth?.repeatBuyers?.repeatRevenueShare);
  push(snapshot.customerHealth?.repeatBuyers?.customersOrdered);
  push(snapshot.customerHealth?.repeatBuyers?.repeatCustomers);
  for (const row of snapshot.competitorBenchmarks?.scorecards ?? []) {
    push(row.medianPrice.value);
    push(row.inStockRate);
    push(row.repricingRate != null ? row.repricingRate * 100 : null);
  }
  return nums;
}

// Any number-looking token with 2+ digits or a decimal point is treated as
// a checkable claim; small bare integers (0-20, e.g. "3 SKUs") are common in
// natural narration and would cause too many false rejections to check
// strictly - the real risk this guards against is a misquoted revenue
// figure or percentage, which always has more precision than that.
function extractCheckableNumbers(text: string): number[] {
  const matches = text.match(/-?\d[\d,]*\.?\d*/g) ?? [];
  return matches
    .map((m) => Number(m.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && (Math.abs(n) >= 21 || !Number.isInteger(n)));
}

function isGrounded(claim: number, ground: number[]): boolean {
  return ground.some((g) => {
    const tolerance = Math.max(Math.abs(g) * 0.02, 0.6); // 2% relative or 0.6 absolute, whichever is looser - rounding slack
    return Math.abs(claim - g) <= tolerance;
  });
}

function buildPrompt(snapshot: ReportSnapshot): string {
  const currency = snapshot.workspace.reportingCurrency;
  const lines = [
    `Business: ${snapshot.workspace.businessName}`,
    `Period: ${snapshot.metadata.period.label}`,
  ];
  if (snapshot.revenue) {
    lines.push(growthLine('Revenue', snapshot.revenue.revenue, currency));
    lines.push(growthLine('Orders', snapshot.revenue.orders, currency));
    const ret = snapshot.revenue.returns;
    if (ret) {
      lines.push(
        `Return rate (refunded orders / all orders, lower is better): ${ret.returnRate.current.toFixed(1)}%` +
          (ret.returnRate.previous != null ? ` (prior period ${ret.returnRate.previous.toFixed(1)}%)` : ''),
      );
      lines.push(`Cancel rate (lower is better): ${ret.cancelRate.current.toFixed(1)}%`);
      lines.push(`Refund value: ${formatCurrency(ret.refundValue.current, currency)} across ${ret.refundedOrders} refunded orders`);
    }
  }
  if (snapshot.productPerformance) {
    lines.push(`Active products: ${snapshot.productPerformance.activeProductCount}`);
  }
  if (snapshot.inventoryRisk) {
    lines.push(`SKUs below the low-stock threshold: ${snapshot.inventoryRisk.lowStockSkuCount}`);
  }
  if (snapshot.marketplacePerformance?.priceIndex) {
    // Was `as string`. The guard above does make it non-null, but the cast
    // asserted that rather than showing it - and a null slipping through
    // would have put the literal text "null" into the model's prompt.
    const priceIndexLine = sourcedLine(
      'Price index vs. market median (100 = at median)',
      snapshot.marketplacePerformance.priceIndex,
    );
    if (priceIndexLine) lines.push(priceIndexLine);
  }
  if (snapshot.marketplacePerformance?.listingShare) {
    const ls = snapshot.marketplacePerformance.listingShare;
    lines.push(
      `Estimated market share by listings (not revenue): ${ls.value.value.toFixed(1)}% - ${ls.sellerListings} of the seller's listings beside ${ls.marketListings} scraped listings across ${ls.platformsInScope} platforms`,
    );
  }
  if (snapshot.pricePositioning?.percentile != null) {
    lines.push(`Price percentile within tracked market: ${snapshot.pricePositioning.percentile}th`);
  }
  if (snapshot.customerHealth) {
    if (snapshot.customerHealth.repeatPurchaseRate != null) {
      lines.push(`Repeat purchase rate: ${snapshot.customerHealth.repeatPurchaseRate}%`);
    }
    lines.push(`At-risk customers: ${snapshot.customerHealth.atRiskCount ?? 0}`);
    const rb = snapshot.customerHealth.repeatBuyers;
    if (rb) {
      lines.push(
        `Returning buyers this period: ${rb.repeatShare.current.toFixed(1)}% of ${rb.customersOrdered} customers who ordered had bought before` +
          (rb.repeatShare.previous != null ? ` (prior period ${rb.repeatShare.previous.toFixed(1)}%)` : ''),
      );
      lines.push(`Revenue from returning buyers: ${rb.repeatRevenueShare.current.toFixed(1)}% of period revenue`);
    }
  }
  for (const row of snapshot.competitorBenchmarks?.scorecards.slice(0, 5) ?? []) {
    lines.push(
      `Competitor ${row.competitorName} (${row.platformName}): median price ${formatCurrency(row.medianPrice.value, currency)}, in-stock ${(row.inStockRate * 100).toFixed(0)}%`,
    );
  }
  for (const signal of snapshot.marketSignals) {
    lines.push(`Signal: ${signal.description}`);
  }
  return lines.join('\n');
}

// Narrates numbers already computed elsewhere in the pipeline - never given
// raw DB access, never asked to invent a figure (same discipline the
// original generate-report-insights.ts already had). NEW here: every
// number the model states gets checked against collectNumericGround()
// before the response is accepted; a hallucinated/misquoted figure causes
// the whole response to be rejected in favor of the static fallback, rather
// than landing on a slide unverified.
export async function narrateReport(snapshot: ReportSnapshot): Promise<NarrationResult> {
  try {
    const result = await callGroqJson<{ summary?: string; highlights?: string[]; recommendedActions?: string[] }>({
      temperature: 0.4,
      system:
        'You are a market research analyst writing a short executive summary for a seller-facing business report. ' +
        'Reply with strict JSON only: {"summary": "2-3 sentence plain-English paragraph", ' +
        '"highlights": ["what changed this cycle", ...], "recommendedActions": ["action to take", ...]} ' +
        'with exactly 3 highlights and exactly 3 recommendedActions, each under 14 words. ' +
        'ONLY cite numbers that appear in the data given below - never estimate, round to a nicer-sounding ' +
        'figure, or state a percentage not explicitly present. ' +
        'Use the currency code given when citing amounts - never assume "$" or "USD".',
      user: buildPrompt(snapshot),
    });

    if (!result.summary) return { ...FALLBACK, rejected: false };

    const highlights = Array.isArray(result.highlights) ? result.highlights.slice(0, 3) : [];
    const recommendedActions = Array.isArray(result.recommendedActions) ? result.recommendedActions.slice(0, 3) : [];

    const ground = collectNumericGround(snapshot);
    const allText = [result.summary, ...highlights, ...recommendedActions].join(' ');
    const claims = extractCheckableNumbers(allText);
    const ungrounded = claims.filter((c) => !isGrounded(c, ground));

    if (ungrounded.length > 0) {
      // Fails closed: reject the whole narration rather than trying to
      // salvage individual sentences - a report is more trustworthy with
      // no AI narrative than with one unverified number in it.
      return { ...FALLBACK, rejected: true };
    }

    return { summary: result.summary, highlights, recommendedActions, rejected: false };
  } catch {
    return { ...FALLBACK, rejected: false };
  }
}
