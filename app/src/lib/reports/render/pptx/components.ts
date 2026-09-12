import type pptxgen from 'pptxgenjs';
import { COLORS, FONT_FAMILY } from '../../design-tokens';
import type { GrowthMetric, MarketSignalKind, ReportMode } from '../../schema';

// Reusable, code-driven building blocks for every slide. Geometry, type
// scale and palette below are taken from the approved reference deck
// (docs/report-reference/new-slides/New_Slides.pptx) via structural
// inspection - a 20x11.25in canvas with a 0.875in content margin, a fixed
// header/footer band, and Inter throughout.
//
// Two hard rules this module exists to enforce:
//   1. No slide builder constructs a raw shape for anything defined here.
//   2. Every element is a native pptxgenjs object (addText/addShape/addChart).
//      There is no addImage call anywhere in this renderer - the reference
//      deck used pre-rendered picture "charts", which is exactly the
//      flattened-image failure mode the brief forbids, so proportional bars
//      are rebuilt from real shapes and distributions from native charts.

export const SLIDE_W = 20;
export const SLIDE_H = 11.25;
export const MARGIN = 0.875;
export const CONTENT_W = SLIDE_W - MARGIN * 2;

const HEADER_RULE_Y = 2.175;
export const CONTENT_TOP = 2.55;
const FOOTER_RULE_Y = 10.375;
const FOOTER_TEXT_Y = 10.708;

const CARD_RADIUS = 0.012; // pptxgenjs rectRadius is a fraction of the smaller side; ~0.2in on a typical card
const HAIRLINE_H = 0.012;

export const TYPE = {
  coverTitle: 64.5,
  coverSubtitle: 23.25,
  dividerTitle: 58,
  dividerSubtitle: 20,
  ghostNumeral: 240,
  slideTitle: 36,
  slideSubtitle: 16.5,
  cardHeading: 19.5,
  kpiLabel: 12,
  kpiValue: 33,
  kpiValueSmall: 27,
  delta: 15,
  rowTitle: 16.5,
  rowSubtitle: 13.5,
  body: 16.5,
  pill: 12,
  footer: 12.75,
  pageNumber: 12.75,
} as const;

export function addCanvas(slide: pptxgen.Slide, color: string = COLORS.canvas): void {
  slide.background = { color };
}

function hairline(slide: pptxgen.Slide, y: number, color: string, x = 0, w = SLIDE_W): void {
  slide.addShape('rect', { x, y, w, h: HAIRLINE_H, fill: { color }, line: { type: 'none' } });
}

/** Standard content-page header: wordmark, page number, title, subtitle, rule. */
export function addHeader(slide: pptxgen.Slide, title: string, subtitle: string, pageLabel: string): void {
  slide.addShape('rect', { x: 0, y: 0, w: SLIDE_W, h: HEADER_RULE_Y, fill: { color: COLORS.paper }, line: { type: 'none' } });
  slide.addText('Ryvl', {
    x: MARGIN,
    y: 0.458,
    w: 3,
    h: 0.3,
    fontFace: FONT_FAMILY,
    fontSize: 16,
    bold: true,
    color: COLORS.brand,
  });
  slide.addText(pageLabel, {
    x: SLIDE_W - MARGIN - 2,
    y: 0.475,
    w: 2,
    h: 0.26,
    align: 'right',
    fontFace: FONT_FAMILY,
    fontSize: TYPE.pageNumber,
    bold: true,
    color: COLORS.grayLight,
  });
  slide.addText(title, {
    x: MARGIN,
    y: 0.917,
    w: CONTENT_W,
    h: 0.642,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.slideTitle,
    bold: true,
    color: COLORS.ink,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: MARGIN,
      y: 1.579,
      w: CONTENT_W,
      h: 0.325,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.slideSubtitle,
      color: COLORS.gray,
    });
  }
  hairline(slide, HEADER_RULE_Y, COLORS.hairline);
}

export function addFooter(slide: pptxgen.Slide, sourceLine: string, mode: ReportMode): void {
  slide.addShape('rect', {
    x: 0,
    y: FOOTER_RULE_Y,
    w: SLIDE_W,
    h: SLIDE_H - FOOTER_RULE_Y,
    fill: { color: COLORS.paper },
    line: { type: 'none' },
  });
  hairline(slide, FOOTER_RULE_Y, COLORS.hairline);
  slide.addText(sourceLine, {
    x: MARGIN,
    y: FOOTER_TEXT_Y,
    w: CONTENT_W - 3,
    h: 0.3,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.footer,
    italic: true,
    color: COLORS.gray,
  });
  addConfidentialityPill(slide, mode, SLIDE_W - MARGIN - 2.42, 10.633);
}

export function addConfidentialityPill(slide: pptxgen.Slide, mode: ReportMode, x: number, y: number): void {
  const internal = mode === 'internal';
  const label = internal ? 'Internal - not for distribution' : 'Confidential';
  const w = internal ? 2.42 : 1.42;
  slide.addShape('roundRect', {
    x: x + (internal ? 0 : 1),
    y,
    w,
    h: 0.367,
    rectRadius: 0.18,
    fill: { color: internal ? COLORS.negativeBg : COLORS.panelBg },
    line: { type: 'none' },
  });
  slide.addText(label, {
    x: x + (internal ? 0 : 1),
    y,
    w,
    h: 0.367,
    align: 'center',
    valign: 'middle',
    fontFace: FONT_FAMILY,
    fontSize: TYPE.pill,
    bold: true,
    color: internal ? COLORS.negative : COLORS.brand,
  });
}

/** White rounded content card - the base surface almost every section sits on. */
export function addCard(slide: pptxgen.Slide, x: number, y: number, w: number, h: number): void {
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h,
    rectRadius: CARD_RADIUS,
    fill: { color: COLORS.paper },
    line: { type: 'none' },
  });
}

export function addCardHeading(slide: pptxgen.Slide, text: string, x: number, y: number, w: number): void {
  slide.addText(text, {
    x,
    y,
    w,
    h: 0.4,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.cardHeading,
    bold: true,
    color: COLORS.ink,
  });
}

export function addEyebrow(slide: pptxgen.Slide, text: string, x: number, y: number, w: number, color: string = COLORS.gray): void {
  slide.addText(text.toUpperCase(), {
    x,
    y,
    w,
    h: 0.28,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.kpiLabel,
    bold: true,
    color,
    charSpacing: 1.2,
  });
}

export interface KpiCardSpec {
  label: string;
  valueText: string;
  deltaText?: string | null;
  deltaDirection?: GrowthMetric['direction'];
  /** Renders on the brand-purple background (cover/divider) rather than a white card. */
  onDark?: boolean;
  /**
   * Raw series for a tiny trend indicator in the card's top-right corner.
   * Only rendered when length >= MIN_SPARKLINE_POINTS - a 2-point "trend"
   * is just a line between two dots, which implies more signal than it has.
   */
  sparkline?: number[] | null;
}

export const MIN_SPARKLINE_POINTS = 3;

/** KPI cards split the given width evenly across however many are passed - never a fixed slot count. */
export function addKpiCardRow(
  slide: pptxgen.Slide,
  pptx: pptxgen,
  cards: KpiCardSpec[],
  x: number,
  y: number,
  w: number,
  h = 1.96,
): void {
  if (cards.length === 0) return;
  const gap = 0.29;
  const cardW = (w - gap * (cards.length - 1)) / cards.length;

  cards.forEach((card, i) => {
    const cardX = x + i * (cardW + gap);
    if (!card.onDark) {
      slide.addShape('roundRect', {
        x: cardX,
        y,
        w: cardW,
        h,
        rectRadius: CARD_RADIUS,
        fill: { color: COLORS.paper },
        line: { type: 'none' },
      });
    }
    const textColor = card.onDark ? COLORS.paper : COLORS.ink;
    const labelColor = card.onDark ? COLORS.paper : COLORS.gray;
    const pad = card.onDark ? 0 : 0.33;
    const hasSparkline = !card.onDark && (card.sparkline?.length ?? 0) >= MIN_SPARKLINE_POINTS;
    const labelW = hasSparkline ? cardW - pad * 2 - 1.05 : cardW - pad * 2;

    slide.addText(card.label.toUpperCase(), {
      x: cardX + pad,
      y: y + (card.onDark ? 0 : 0.29),
      w: labelW,
      h: 0.28,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.kpiLabel,
      bold: true,
      color: labelColor,
      charSpacing: 1.2,
      transparency: card.onDark ? 30 : 0,
    });
    if (hasSparkline) {
      addSparkline(slide, pptx, card.sparkline as number[], cardX + cardW - pad - 1.0, y + 0.24, 1.0, 0.42);
    }
    slide.addText(card.valueText, {
      x: cardX + pad,
      y: y + (card.onDark ? 0.3 : 0.66),
      w: cardW - pad * 2,
      h: 0.7,
      fontFace: FONT_FAMILY,
      fontSize: card.onDark ? TYPE.kpiValueSmall : TYPE.kpiValue,
      bold: true,
      color: textColor,
    });
    if (card.deltaText) {
      const deltaColor =
        card.deltaDirection === 'up'
          ? card.onDark
            ? COLORS.positiveOnDark
            : COLORS.positive
          : card.deltaDirection === 'down'
            ? COLORS.negative
            : COLORS.grayLight;
      slide.addText(card.deltaText, {
        x: cardX + pad,
        y: y + h - (card.onDark ? 0.35 : 0.62),
        w: cardW - pad * 2,
        h: 0.32,
        fontFace: FONT_FAMILY,
        fontSize: TYPE.delta,
        bold: true,
        color: deltaColor,
      });
    }
  });
}

/**
 * Tiny native trend indicator - no axes, no legend, no gridlines, just the
 * line - meant to sit inside a KPI card's corner. A real chart object (not
 * a picture), gated by the caller on MIN_SPARKLINE_POINTS.
 */
export function addSparkline(
  slide: pptxgen.Slide,
  pptx: pptxgen,
  values: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  color: string = COLORS.brandAccent,
): void {
  slide.addChart(pptx.ChartType.line, [{ name: 'trend', labels: values.map((_, i) => String(i + 1)), values }], {
    x,
    y,
    w,
    h,
    chartColors: [color],
    showLegend: false,
    showValue: false,
    showTitle: false,
    lineSize: 2,
    lineDataSymbol: 'none',
    catAxisHidden: true,
    valAxisHidden: true,
    catAxisLineShow: false,
    valAxisLineShow: false,
    plotArea: { border: { pt: 0, color: 'FFFFFF' } },
    chartArea: { border: { pt: 0, color: 'FFFFFF' } },
  });
}

export function kpiCardFromGrowth(
  label: string,
  m: GrowthMetric,
  formatValue: (v: number) => string,
  onDark = false,
): KpiCardSpec {
  return {
    label,
    valueText: formatValue(m.current),
    deltaText:
      m.changePct != null
        ? `${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(1)}% vs. prior period`
        : 'No prior-period baseline',
    deltaDirection: m.direction,
    onDark,
  };
}

/** Status pill - Included / Not enough data / Omitted, and severity badges. */
export type PillTone = 'positive' | 'negative' | 'warning' | 'info' | 'neutral';

const PILL_TONES: Record<PillTone, { bg: string; fg: string }> = {
  positive: { bg: COLORS.positiveBg, fg: COLORS.positive },
  negative: { bg: COLORS.negativeBg, fg: COLORS.negative },
  warning: { bg: COLORS.warningBg, fg: COLORS.warning },
  info: { bg: COLORS.infoBg, fg: COLORS.info },
  neutral: { bg: COLORS.canvas, fg: COLORS.grayLight },
};

export function addPill(
  slide: pptxgen.Slide,
  text: string,
  tone: PillTone,
  x: number,
  y: number,
  w: number,
  h = 0.296,
): void {
  const { bg, fg } = PILL_TONES[tone];
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.34, fill: { color: bg }, line: { type: 'none' } });
  slide.addText(text, {
    x,
    y,
    w,
    h,
    align: 'center',
    valign: 'middle',
    fontFace: FONT_FAMILY,
    fontSize: TYPE.pill,
    bold: true,
    color: fg,
  });
}

/**
 * Proportional bar row - the reference deck's core data visual. A light
 * "track" rect with a colored "fill" rect whose width encodes the value.
 * Rebuilt from real shapes (the reference used pasted images for some of
 * these), so it stays editable in PowerPoint.
 */
export interface BarRowSpec {
  title: string;
  subtitle?: string | null;
  valueText: string;
  /** 0-1. Drives fill width relative to the track. */
  ratio: number;
  color?: string;
}

export function addBarRows(
  slide: pptxgen.Slide,
  rows: BarRowSpec[],
  x: number,
  y: number,
  w: number,
  rowPitch = 1.06,
): void {
  const trackW = w * 0.62;
  const trackH = 0.146;

  rows.forEach((row, i) => {
    const rowY = y + i * rowPitch;
    slide.addText(row.title, {
      x,
      y: rowY,
      w: w - 2.2,
      h: 0.32,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.rowTitle,
      bold: true,
      color: COLORS.ink,
    });
    if (row.subtitle) {
      slide.addText(row.subtitle, {
        x,
        y: rowY + 0.3,
        w: w - 2.2,
        h: 0.26,
        fontFace: FONT_FAMILY,
        fontSize: TYPE.rowSubtitle,
        color: COLORS.grayLight,
      });
    }
    const barY = rowY + (row.subtitle ? 0.66 : 0.4);
    slide.addShape('roundRect', {
      x,
      y: barY,
      w: trackW,
      h: trackH,
      rectRadius: 0.5,
      fill: { color: COLORS.canvas },
      line: { type: 'none' },
    });
    const fillW = Math.max(trackW * Math.min(Math.max(row.ratio, 0), 1), 0.04);
    slide.addShape('roundRect', {
      x,
      y: barY,
      w: fillW,
      h: trackH,
      rectRadius: 0.5,
      fill: { color: row.color ?? COLORS.rankRamp[Math.min(i, COLORS.rankRamp.length - 1)] },
      line: { type: 'none' },
    });
    slide.addText(row.valueText, {
      x: x + w - 2.1,
      y: rowY + 0.1,
      w: 2.1,
      h: 0.4,
      align: 'right',
      fontFace: FONT_FAMILY,
      fontSize: TYPE.rowTitle,
      bold: true,
      color: COLORS.ink,
    });
    if (i < rows.length - 1) {
      hairline(slide, rowY + rowPitch - 0.16, COLORS.hairlineSoft, x, w);
    }
  });
}

/** A "table" built as positioned rows (the reference deck uses no native tables). */
export function addDataRows(
  slide: pptxgen.Slide,
  headers: string[],
  rows: (string | number)[][],
  colWidths: number[],
  x: number,
  y: number,
  w: number,
  rowPitch = 0.72,
): void {
  let cx = x;
  headers.forEach((h, i) => {
    slide.addText(h.toUpperCase(), {
      x: cx,
      y,
      w: colWidths[i],
      h: 0.3,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.kpiLabel,
      bold: true,
      color: COLORS.grayLight,
      charSpacing: 1.1,
      align: i === 0 ? 'left' : 'right',
    });
    cx += colWidths[i];
  });
  hairline(slide, y + 0.42, COLORS.hairline, x, w);

  rows.forEach((row, r) => {
    const rowY = y + 0.62 + r * rowPitch;
    let colX = x;
    row.forEach((cell, c) => {
      slide.addText(String(cell), {
        x: colX,
        y: rowY,
        w: colWidths[c],
        h: 0.4,
        fontFace: FONT_FAMILY,
        fontSize: TYPE.rowTitle,
        bold: c === 0,
        color: c === 0 ? COLORS.ink : COLORS.gray,
        align: c === 0 ? 'left' : 'right',
      });
      colX += colWidths[c];
    });
    if (r < rows.length - 1) hairline(slide, rowY + rowPitch - 0.18, COLORS.hairlineSoft, x, w);
  });
}

/** Light-purple insight/callout panel with an eyebrow and body copy. */
export function addInsightPanel(
  slide: pptxgen.Slide,
  eyebrow: string,
  body: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: CARD_RADIUS, fill: { color: COLORS.panelBg }, line: { type: 'none' } });
  slide.addText(eyebrow.toUpperCase(), {
    x: x + 0.42,
    y: y + 0.29,
    w: w - 0.84,
    h: 0.28,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.kpiLabel,
    bold: true,
    color: COLORS.brandAccent,
    charSpacing: 1.2,
  });
  slide.addText(body, {
    x: x + 0.42,
    y: y + 0.66,
    w: w - 0.84,
    h: h - 0.95,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.body,
    color: COLORS.ink,
    valign: 'top',
  });
}

/**
 * Priority accent runs along the TOP edge (matching the reference deck),
 * not a left-side strip. `timeframe` ("Act this week" / "Next 30 days") is
 * a deterministic label derived from priority by the caller - never a
 * fabricated urgency claim, just a plain-English restatement of the same
 * priority the badge already shows.
 */
export function addRecommendationCard(
  slide: pptxgen.Slide,
  index: number,
  priority: 'high' | 'medium' | 'low',
  text: string,
  timeframe: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const tone: PillTone = priority === 'high' ? 'negative' : priority === 'medium' ? 'warning' : 'neutral';
  const accent = priority === 'high' ? COLORS.negative : priority === 'medium' ? COLORS.warningAccent : COLORS.grayLight;
  slide.addShape('roundRect', { x, y, w, h, rectRadius: CARD_RADIUS, fill: { color: COLORS.paper }, line: { type: 'none' } });
  slide.addShape('rect', { x, y, w, h: 0.06, fill: { color: accent }, line: { type: 'none' } });
  slide.addText(String(index).padStart(2, '0'), {
    x: x + 0.36,
    y: y + 0.37,
    w: 0.6,
    h: 0.52,
    fontFace: FONT_FAMILY,
    fontSize: 22,
    bold: true,
    color: COLORS.grayLight,
  });
  // 0.75in was sized for "HIGH"/"LOW" and wrapped "MEDIUM" mid-word at the
  // same 12pt bold font (PowerPoint/Google Slides don't shrink-to-fit an
  // addText box by default). 0.95in matches signalBadge's pill width just
  // above, already proven to fit the similarly-sized "POSITION" (8 chars).
  addPill(slide, priority.toUpperCase(), tone, x + w - 1.35, y + 0.44, 0.95, 0.34);
  slide.addText(text, {
    x: x + 0.36,
    y: y + 0.99,
    w: w - 0.72,
    h: h - (timeframe ? 1.7 : 1.3),
    fontFace: FONT_FAMILY,
    fontSize: TYPE.rowTitle,
    bold: true,
    color: COLORS.ink,
    valign: 'top',
  });
  if (timeframe) {
    slide.addText(timeframe, {
      x: x + 0.36,
      y: y + h - 0.56,
      w: w - 0.72,
      h: 0.28,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.rowSubtitle,
      color: COLORS.grayLight,
    });
  }
}

/**
 * Deterministic badge for a market signal's kind - never invented, always a
 * direct mapping from the rule-engine's own classification
 * (rules/market-signals.ts). "price_war"/"new_entrant" read as things worth
 * watching; "supply_void" as an opening; "demand_rising" as a statement
 * about the seller's own position.
 */
export function signalBadge(kind: MarketSignalKind): { label: string; tone: PillTone } {
  switch (kind) {
    case 'price_war':
      return { label: 'WATCH', tone: 'warning' };
    case 'new_entrant':
      return { label: 'WATCH', tone: 'warning' };
    case 'supply_void':
      return { label: 'OPENING', tone: 'positive' };
    case 'demand_rising':
      return { label: 'POSITION', tone: 'info' };
  }
}

/**
 * Solid brand-purple "hero" card for the AI-narrated executive summary,
 * with an optional 3-metric micro-row along the bottom - both eyebrow and
 * micro-metrics are always real snapshot data, never invented to fill space.
 */
export function addInsightCard(
  slide: pptxgen.Slide,
  eyebrow: string,
  body: string,
  microMetrics: { label: string; value: string }[],
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: CARD_RADIUS, fill: { color: COLORS.brand }, line: { type: 'none' } });
  slide.addText(eyebrow.toUpperCase(), {
    x: x + 0.42,
    y: y + 0.42,
    w: w - 0.84,
    h: 0.3,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.kpiLabel,
    bold: true,
    color: COLORS.paper,
    charSpacing: 1.5,
    transparency: 15,
  });
  const bodyH = microMetrics.length > 0 ? h - 2.15 : h - 1.15;
  slide.addText(body, {
    x: x + 0.42,
    y: y + 0.84,
    w: w - 0.84,
    h: bodyH,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.body,
    color: COLORS.paper,
    valign: 'top',
  });

  if (microMetrics.length > 0) {
    const stripY = y + h - 1.3;
    slide.addShape('rect', { x: x + 0.42, y: stripY, w: w - 0.84, h: HAIRLINE_H, fill: { color: COLORS.paper }, line: { type: 'none' } });
    const colW = (w - 0.84) / microMetrics.length;
    microMetrics.forEach((m, i) => {
      const mx = x + 0.42 + i * colW;
      slide.addText(m.label.toUpperCase(), {
        x: mx,
        y: stripY + 0.22,
        w: colW - 0.2,
        h: 0.24,
        fontFace: FONT_FAMILY,
        fontSize: 11,
        bold: true,
        color: COLORS.paper,
        charSpacing: 1,
        transparency: 30,
      });
      slide.addText(m.value, {
        x: mx,
        y: stripY + 0.48,
        w: colW - 0.2,
        h: 0.4,
        fontFace: FONT_FAMILY,
        fontSize: 19,
        bold: true,
        color: COLORS.paper,
      });
    });
  }
}

export interface PriceLadderRung {
  label: string;
  valueText: string;
  /** Raw numeric value, used only to compute proportional bar width - never displayed directly (valueText is). */
  value: number;
  color?: string;
  emphasized?: boolean;
}

/**
 * Horizontal proportional-bar price ladder - the reference deck's
 * signature Pricing Intelligence visual. Rungs are whatever the caller has
 * real data for (typically: your price, market median, recommended band
 * low/high) - never padded with invented "lowest/highest tracked" values
 * the schema doesn't carry.
 */
export function addPriceLadder(
  slide: pptxgen.Slide,
  rungs: PriceLadderRung[],
  x: number,
  y: number,
  w: number,
  rowPitch = 0.72,
): void {
  const max = Math.max(...rungs.map((r) => r.value), 1);
  const trackX = x;
  const trackW = w - 2.1;
  const trackH = 0.17;

  rungs.forEach((rung, i) => {
    const rowY = y + i * rowPitch;
    slide.addText(rung.label, {
      x,
      y: rowY,
      w: 2.2,
      h: 0.28,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.rowSubtitle,
      bold: rung.emphasized,
      color: rung.emphasized ? COLORS.ink : COLORS.gray,
    });
    slide.addShape('roundRect', {
      x: trackX,
      y: rowY + 0.32,
      w: trackW,
      h: trackH,
      rectRadius: 0.5,
      fill: { color: COLORS.canvas },
      line: { type: 'none' },
    });
    // A pure linear scale makes any rung more than ~10x smaller than the
    // largest one (e.g. a recommended-band low next to a much higher band
    // high) render as an invisible hairline - the rung's own value label is
    // still exact text, but the bar next to it should at least be visible as
    // a bar. Floor the fill at 6% of the track so every rung reads as a real
    // bar; this does distort proportionality for the smallest values, which
    // is an intentional legibility trade-off, not an attempt to mislead -
    // the exact number is always printed beside the bar.
    const fillW = Math.max(trackW * Math.min(rung.value / max, 1), trackW * 0.06);
    slide.addShape('roundRect', {
      x: trackX,
      y: rowY + 0.32,
      w: fillW,
      h: trackH,
      rectRadius: 0.5,
      fill: { color: rung.color ?? COLORS.brandAccent },
      line: { type: 'none' },
    });
    slide.addText(rung.valueText, {
      x: x + w - 1.85,
      y: rowY,
      w: 1.85,
      h: 0.28,
      align: 'right',
      fontFace: FONT_FAMILY,
      fontSize: TYPE.rowSubtitle,
      bold: true,
      color: COLORS.ink,
    });
  });
}

/** Full-bleed brand-purple section divider with an optional 3-stat footer strip. */
export function addSectionDivider(
  pptx: pptxgen,
  sectionNumber: number,
  sectionTotal: number,
  title: string,
  subtitle: string,
  stats: { label: string; value: string }[],
  mode: ReportMode,
): void {
  const slide = pptx.addSlide();
  addCanvas(slide, COLORS.brand);

  slide.addText('Ryvl', {
    x: MARGIN,
    y: 0.667,
    w: 3,
    h: 0.3,
    fontFace: FONT_FAMILY,
    fontSize: 16,
    bold: true,
    color: COLORS.paper,
  });
  slide.addText(`Section ${String(sectionNumber).padStart(2, '0')} of ${String(sectionTotal).padStart(2, '0')}`, {
    x: SLIDE_W - MARGIN - 3,
    y: 0.735,
    w: 3,
    h: 0.3,
    align: 'right',
    fontFace: FONT_FAMILY,
    fontSize: TYPE.pill,
    bold: true,
    color: COLORS.paper,
    transparency: 25,
  });

  // Oversized ghost numeral, right side - the reference deck's signature divider motif.
  slide.addText(String(sectionNumber).padStart(2, '0'), {
    x: SLIDE_W - 6.5,
    y: 2.2,
    w: 6,
    h: 3.6,
    align: 'right',
    fontFace: FONT_FAMILY,
    fontSize: TYPE.ghostNumeral,
    bold: true,
    color: COLORS.paper,
    transparency: 88,
  });

  slide.addText(`SECTION ${String(sectionNumber).padStart(2, '0')}`, {
    x: MARGIN,
    y: 4.1,
    w: CONTENT_W,
    h: 0.32,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.kpiLabel,
    bold: true,
    color: COLORS.paper,
    charSpacing: 2,
    transparency: 30,
  });
  slide.addText(title, {
    x: MARGIN,
    y: 4.5,
    w: CONTENT_W * 0.72,
    h: 1.5,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.dividerTitle,
    bold: true,
    color: COLORS.paper,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: MARGIN,
      y: 6.1,
      w: CONTENT_W * 0.62,
      h: 0.9,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.dividerSubtitle,
      color: COLORS.paper,
      transparency: 22,
    });
  }

  if (stats.length > 0) {
    const stripY = 8.2;
    slide.addShape('rect', {
      x: MARGIN,
      y: stripY,
      w: CONTENT_W,
      h: HAIRLINE_H,
      fill: { color: COLORS.paper },
      line: { type: 'none' },
    });
    const colW = CONTENT_W / stats.length;
    stats.forEach((stat, i) => {
      const sx = MARGIN + i * colW;
      slide.addText(stat.label.toUpperCase(), {
        x: sx,
        y: stripY + 0.42,
        w: colW - 0.4,
        h: 0.3,
        fontFace: FONT_FAMILY,
        fontSize: TYPE.kpiLabel,
        bold: true,
        color: COLORS.paper,
        charSpacing: 1.2,
        transparency: 35,
      });
      slide.addText(stat.value, {
        x: sx,
        y: stripY + 0.75,
        w: colW - 0.4,
        h: 0.7,
        fontFace: FONT_FAMILY,
        fontSize: 30,
        bold: true,
        color: COLORS.paper,
      });
    });
  }

  addConfidentialityPill(slide, mode, SLIDE_W - MARGIN - 2.42, 10.5);
}

export function addNativeBarChart(
  slide: pptxgen.Slide,
  pptx: pptxgen,
  categories: string[],
  values: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  color: string = COLORS.brandAccent,
): void {
  slide.addChart(pptx.ChartType.bar, [{ name: 'Value', labels: categories, values }], {
    x,
    y,
    w,
    h,
    chartColors: [color],
    showLegend: false,
    showValue: false,
    barGapWidthPct: 45,
    catAxisLabelFontFace: FONT_FAMILY,
    catAxisLabelFontSize: 12,
    catAxisLabelColor: COLORS.gray,
    valAxisLabelFontFace: FONT_FAMILY,
    valAxisLabelFontSize: 12,
    valAxisLabelColor: COLORS.gray,
    valGridLine: { style: 'solid', color: COLORS.hairline, size: 1 },
    catAxisLineShow: false,
    valAxisLineShow: false,
  });
}

export function addNativeLineChart(
  slide: pptxgen.Slide,
  pptx: pptxgen,
  categories: string[],
  series: { name: string; values: number[] }[],
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  slide.addChart(
    pptx.ChartType.line,
    series.map((s) => ({ name: s.name, labels: categories, values: s.values })),
    {
      x,
      y,
      w,
      h,
      chartColors: [COLORS.brandAccent, COLORS.info, COLORS.positive],
      showLegend: series.length > 1,
      legendPos: 'b',
      legendFontFace: FONT_FAMILY,
      legendFontSize: 12,
      lineDataSymbol: 'circle',
      lineDataSymbolSize: 7,
      lineSize: 3,
      catAxisLabelFontFace: FONT_FAMILY,
      catAxisLabelFontSize: 11,
      catAxisLabelColor: COLORS.gray,
      valAxisLabelFontFace: FONT_FAMILY,
      valAxisLabelFontSize: 12,
      valAxisLabelColor: COLORS.gray,
      valGridLine: { style: 'solid', color: COLORS.hairline, size: 1 },
      catAxisLineShow: false,
      valAxisLineShow: false,
    },
  );
}
