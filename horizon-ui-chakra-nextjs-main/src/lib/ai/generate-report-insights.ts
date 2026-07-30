'server-only';

import { callGroqJson } from '@/lib/ai/groq-client';
import type { ReportData } from '@/lib/reports/collect-report-data';

export type ReportInsights = {
  summary: string;
  highlights: string[];
};

const FALLBACK_INSIGHTS: ReportInsights = {
  summary:
    'This report summarizes recent store performance, market position, and customer retention based on the seller\'s own data.',
  highlights: [],
};

function buildPrompt(data: ReportData): string {
  const lines = [
    `Business: ${data.seller.businessName}`,
    `Domain / category: ${data.domainName ?? 'not set'}`,
    `Period: ${data.periodLabel}`,
    `Revenue: ${data.revenue}`,
    `Orders: ${data.orderCount}`,
    `Average order value: ${data.avgOrderValue.toFixed(2)}`,
    `Active products: ${data.activeProductCount}`,
  ];
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
  return lines.join('\n');
}

// Turns the raw numbers already in ReportData into a short written
// narrative - the reference report templates the report feature is meant
// to match all lead with a plain-English "what this means" paragraph
// before the tables, not just a wall of numbers. Falls back to a generic
// line (never blocks report generation) if Groq isn't configured or errors.
export async function generateReportInsights(data: ReportData): Promise<ReportInsights> {
  try {
    const result = await callGroqJson<{ summary?: string; highlights?: string[] }>({
      temperature: 0.5,
      system:
        'You are a market research analyst writing a short executive summary for a seller-facing business report. ' +
        'Reply with strict JSON only: {"summary": "2-3 sentence plain-English paragraph", "highlights": ["short highlight", ...]} ' +
        'with exactly 3 highlights, each under 12 words. Be specific to the numbers given, factual, and concise - no generic filler, no markdown.',
      user: buildPrompt(data),
    });

    if (!result.summary) return FALLBACK_INSIGHTS;
    return {
      summary: result.summary,
      highlights: Array.isArray(result.highlights) ? result.highlights.slice(0, 3) : [],
    };
  } catch {
    return FALLBACK_INSIGHTS;
  }
}
