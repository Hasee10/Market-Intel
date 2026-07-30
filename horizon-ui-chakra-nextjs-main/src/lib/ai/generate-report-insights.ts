'server-only';

import { callGroqJson } from '@/lib/ai/groq-client';
import type { ReportData } from '@/lib/reports/collect-report-data';

export type ReportInsights = {
  summary: string;
  highlights: string[];
  recommendedActions: string[];
};

const FALLBACK_INSIGHTS: ReportInsights = {
  summary:
    'This report summarizes recent store performance, market position, and customer retention based on the seller\'s own data.',
  highlights: [],
  recommendedActions: [],
};

function buildPrompt(data: ReportData): string {
  const lines = [
    `Business: ${data.seller.businessName}`,
    `Domain / category: ${data.domainName ?? 'not set'}`,
    `Period: ${data.periodLabel}`,
    `Revenue: ${data.revenue} (prior period: ${data.previousRevenue})`,
    `Orders: ${data.orderCount} (prior period: ${data.previousOrderCount})`,
    `Average order value: ${data.avgOrderValue.toFixed(2)}`,
    `Active products: ${data.activeProductCount}`,
    `Products below the low-stock threshold: ${data.lowStockCount}`,
  ];
  if (data.priceIndex != null) {
    lines.push(`Price index vs category median (100 = at median): ${data.priceIndex.toFixed(1)}`);
  }
  if (data.categoryPricing) {
    lines.push(
      `Category-wide competitor pricing: P25 ${data.categoryPricing.p25}, median ${data.categoryPricing.median}, P75 ${data.categoryPricing.p75}, ${data.categoryPricing.count} listings tracked`,
    );
  }
  if (data.churn) {
    lines.push(
      `Retention rate: ${data.churn.retentionRate ?? 'n/a'}%, repeat purchase rate: ${data.churn.repeatPurchaseRate ?? 'n/a'}%, avg customer value: ${data.churn.avgClv ?? 'n/a'}`,
    );
  }
  lines.push(`At-risk customers (inactive but previously engaged): ${data.atRiskCount}`);
  return lines.join('\n');
}

// Turns the raw numbers already in ReportData into a short written
// narrative and a set of recommended actions - the report template this
// feeds (see generate-pptx.ts) has dedicated "What Changed" and
// "Recommended Actions" bullet slots that read as boilerplate if left
// static. Falls back to generic content (never blocks report generation)
// if Groq isn't configured or errors.
export async function generateReportInsights(data: ReportData): Promise<ReportInsights> {
  try {
    const result = await callGroqJson<{ summary?: string; highlights?: string[]; recommendedActions?: string[] }>({
      temperature: 0.5,
      system:
        'You are a market research analyst writing a short executive summary for a seller-facing business report. ' +
        'Reply with strict JSON only: {"summary": "2-3 sentence plain-English paragraph", ' +
        '"highlights": ["what changed this cycle", ...], "recommendedActions": ["action to take", ...]} ' +
        'with exactly 3 highlights and exactly 3 recommendedActions, each under 14 words. ' +
        'Highlights describe what the numbers show; recommendedActions are concrete next steps a seller should take. ' +
        'Be specific to the numbers given, factual, and concise - no generic filler, no markdown.',
      user: buildPrompt(data),
    });

    if (!result.summary) return FALLBACK_INSIGHTS;
    return {
      summary: result.summary,
      highlights: Array.isArray(result.highlights) ? result.highlights.slice(0, 3) : [],
      recommendedActions: Array.isArray(result.recommendedActions) ? result.recommendedActions.slice(0, 3) : [],
    };
  } catch {
    return FALLBACK_INSIGHTS;
  }
}
