// The single design source for both the PPTX and PDF renderers - no
// shape/text color literal in render/pptx/* or render/pdf/* outside this
// module. Palette below was extracted directly from the approved
// "top-tier" reference deck (docs/report-reference/new-slides/New_Slides.pptx,
// 2026-08-04) via a structural python-pptx inspection - every hex value
// here is a real value pulled from that file, not a guess at matching it.
export const COLORS = {
  // Brand purple - primary/divider background and accent.
  brand: '4B3AF0',
  brandAccent: '422AFB', // secondary accent - "your position" markers, eyebrow labels, links
  // Rank ramp (darkest = rank 1), used for any ordered proportional-bar list
  // (top products, top competitors) so item order reads visually, not just numerically.
  rankRamp: ['422AFB', '5B45FF', '7551FF', '8E74FF', 'A995FF'],

  // Text
  ink: '1B2559', // primary dark navy text - titles, KPI values, body headings
  gray: '707EAE', // secondary/muted text - subtitles, labels, footnotes, source lines
  grayLight: 'A3AED0', // tertiary muted text - SKU codes, page numbers, "not enough data"
  grayLightest: 'C6CEE6', // lightest muted - "-" placeholder for omitted rows

  // Surfaces
  paper: 'FFFFFF',
  canvas: 'F4F7FE', // standard content-slide background (very light lavender-gray)
  hairline: 'E9EDF7', // header/footer divider rule
  hairlineSoft: 'F0F3FA', // in-card row divider

  // Semantic - positive/negative/warning/info, each with a paired pill background
  positive: '01B574',
  positiveBg: 'E6FAF5',
  positiveOnDark: '6CF2BD', // brighter mint for delta text on the purple divider/cover background
  negative: 'EE5D50',
  negativeBg: 'FEEFEE',
  warning: 'B37610',
  warningBg: 'FFF6DA',
  warningAccent: 'FFB547', // solid warning accent bar (progress-bar fill variant)
  info: '3965FF',
  infoBg: 'EFF4FB',
  panelBg: 'F2EFFF', // light-purple info/insight panel background
} as const;

export const CHART_PALETTE = [
  COLORS.brandAccent,
  COLORS.info,
  COLORS.positive,
  COLORS.warningAccent,
  COLORS.negative,
  ...COLORS.rankRamp.slice(1),
];

// Semantic aliases so render code reads by meaning, not by raw color name -
// e.g. a positive growth number should never need the renderer to know
// which hex is "green," just that it's a positive-direction figure.
export const SEMANTIC = {
  positive: COLORS.positive,
  negative: COLORS.negative,
  neutral: COLORS.grayLight,
  info: COLORS.info,
  warning: COLORS.warning,
} as const;

export const FONT_FAMILY = 'Inter'; // matches the app-wide font (see mind.md's font-swap note) and the
// reference deck itself (100% Inter, zero exceptions across 358 text runs checked) - a report generated
// for a seller should look like it came from the same product they use daily.

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
