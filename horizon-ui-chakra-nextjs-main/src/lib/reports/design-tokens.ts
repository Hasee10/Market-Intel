// One brand/design source for both the PPTX and PDF renderers so a change
// to the palette or copy doesn't have to be made twice.
export const COLORS = {
  navy: '0B1437',
  navyLight: '111C4E',
  indigo: '4318FF',
  indigoLight: '7551FF',
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

export function formatCurrency(value: number, currency = 'PKR') {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number | null) {
  return value != null ? `${value.toFixed(1)}%` : '-';
}

export function formatMetricName(metricName: string) {
  return metricName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
