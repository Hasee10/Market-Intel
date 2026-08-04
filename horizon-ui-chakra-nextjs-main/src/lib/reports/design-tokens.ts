// The single design source for both the PPTX and PDF renderers - previously
// each renderer had its own hardcoded palette (generate-pptx.ts's own
// POSITIVE/NEGATIVE/NEUTRAL/INFO constants vs. this file), which is exactly
// the kind of drift that makes "consistent chart and table styling" (the
// design brief) impossible to guarantee. Every color used by either
// renderer must come from here - no shape/text color literal in
// render/pptx/* or render/pdf/* outside this module.
export const COLORS = {
  navy: '0B1437',
  navyLight: '111C4E',
  indigo: '4318FF',
  indigoLight: '7551FF',
  lavender: 'E9E3FF',
  lavenderTint: 'F4F1FF',
  cyan: '6AD2FF',
  green: '05CD99',
  amber: 'FFB547',
  red: 'EE5D50',
  ink: '1B2559',
  gray: '667085',
  grayLight: 'A3AED0',
  border: 'E5E9F2',
  paper: 'FFFFFF',
  offWhite: 'F8F9FE',
} as const;

export const CHART_PALETTE = [COLORS.indigo, COLORS.cyan, COLORS.green, COLORS.amber, COLORS.red, COLORS.indigoLight];

// Semantic aliases so render code reads by meaning, not by raw color name -
// e.g. a positive growth number should never need the renderer to know it's
// "green" specifically, just that it's a positive-direction figure.
export const SEMANTIC = {
  positive: COLORS.green,
  negative: COLORS.red,
  neutral: COLORS.grayLight,
  info: COLORS.indigo,
} as const;

export const FONT_FAMILY = 'Inter'; // matches the app-wide font (see mind.md's font-swap note) - a report
// generated for a seller should look like it came from the same product they use daily.

export function formatCurrency(value: number, currency = 'PKR'): string {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number | null, decimals = 1): string {
  return value != null ? `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%` : 'N/A';
}

export function formatMetricName(metricName: string): string {
  return metricName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
