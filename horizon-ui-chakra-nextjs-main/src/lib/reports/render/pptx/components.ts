import type pptxgen from 'pptxgenjs';
import { COLORS, FONT_FAMILY, formatCurrency, formatPercent } from '../../design-tokens';
import type { GrowthMetric, ReportMode } from '../../schema';

// Reusable, code-driven building blocks for every slide - this is the
// "reusable components" requirement from the brief made literal: no slide
// builder in slides/*.ts constructs raw shapes inline for anything defined
// here. Every element added is a native pptxgenjs object (addText/addTable/
// addChart/addShape) - there is no addImage call anywhere in this renderer,
// which is the direct fix for the flattened-chart-image bug found in the
// previous template (docs/reports-v2-architecture.md §1).

export const SLIDE_W = 13.333;
export const SLIDE_H = 7.5;
export const MARGIN = 0.58;
export const CONTENT_W = SLIDE_W - MARGIN * 2;

export function addBackground(slide: pptxgen.Slide, color: string = COLORS.paper): void {
  slide.background = { color };
}

export function addHeader(slide: pptxgen.Slide, title: string, subtitle: string, pageLabel: string): void {
  slide.addText('Ryvl', {
    x: MARGIN,
    y: 0.32,
    w: 2,
    h: 0.3,
    fontFace: FONT_FAMILY,
    fontSize: 12,
    bold: true,
    color: COLORS.indigo,
  });
  slide.addText(pageLabel, {
    x: SLIDE_W - MARGIN - 2,
    y: 0.32,
    w: 2,
    h: 0.3,
    align: 'right',
    fontFace: FONT_FAMILY,
    fontSize: 10,
    color: COLORS.grayLight,
  });
  slide.addText(title, {
    x: MARGIN,
    y: 0.7,
    w: CONTENT_W,
    h: 0.5,
    fontFace: FONT_FAMILY,
    fontSize: 24,
    bold: true,
    color: COLORS.navy,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: MARGIN,
      y: 1.18,
      w: CONTENT_W,
      h: 0.35,
      fontFace: FONT_FAMILY,
      fontSize: 12,
      color: COLORS.gray,
    });
  }
  slide.addShape('rect', {
    x: MARGIN,
    y: 1.58,
    w: CONTENT_W,
    h: 0.02,
    fill: { color: COLORS.border },
    line: { type: 'none' },
  });
}

export function addFooter(slide: pptxgen.Slide, sourceLine: string, mode: ReportMode): void {
  slide.addText(sourceLine, {
    x: MARGIN,
    y: SLIDE_H - 0.42,
    w: CONTENT_W - 1.6,
    h: 0.3,
    fontFace: FONT_FAMILY,
    fontSize: 8,
    color: COLORS.grayLight,
    italic: true,
  });
  addConfidentialityLabel(slide, mode);
}

export function addConfidentialityLabel(slide: pptxgen.Slide, mode: ReportMode): void {
  const label = mode === 'internal' ? 'Internal - not for distribution' : 'Confidential';
  slide.addText(label, {
    x: SLIDE_W - MARGIN - 2.2,
    y: SLIDE_H - 0.42,
    w: 2.2,
    h: 0.3,
    align: 'right',
    fontFace: FONT_FAMILY,
    fontSize: 8,
    bold: true,
    color: mode === 'internal' ? COLORS.red : COLORS.gray,
  });
}

export interface KpiCardSpec {
  label: string;
  valueText: string;
  deltaText?: string | null;
  deltaDirection?: GrowthMetric['direction'];
}

// Cards lay out left-to-right across whatever width is given, splitting
// evenly - the number of cards is driven entirely by how many are passed
// in, never a fixed 3-or-4 hardcoded slot count.
export function addKpiCardRow(slide: pptxgen.Slide, cards: KpiCardSpec[], x: number, y: number, w: number, h: number): void {
  if (cards.length === 0) return;
  const gap = 0.16;
  const cardW = (w - gap * (cards.length - 1)) / cards.length;

  cards.forEach((card, i) => {
    const cardX = x + i * (cardW + gap);
    slide.addShape('roundRect', {
      x: cardX,
      y,
      w: cardW,
      h,
      rectRadius: 0.08,
      fill: { color: COLORS.lavenderTint },
      line: { type: 'none' },
    });
    slide.addText(card.label.toUpperCase(), {
      x: cardX + 0.14,
      y: y + 0.12,
      w: cardW - 0.28,
      h: 0.24,
      fontFace: FONT_FAMILY,
      fontSize: 9,
      bold: true,
      color: COLORS.gray,
      charSpacing: 1,
    });
    slide.addText(card.valueText, {
      x: cardX + 0.14,
      y: y + 0.38,
      w: cardW - 0.28,
      h: 0.46,
      fontFace: FONT_FAMILY,
      fontSize: 22,
      bold: true,
      color: COLORS.navy,
    });
    if (card.deltaText) {
      const deltaColor =
        card.deltaDirection === 'up' ? COLORS.green : card.deltaDirection === 'down' ? COLORS.red : COLORS.grayLight;
      slide.addText(card.deltaText, {
        x: cardX + 0.14,
        y: y + h - 0.32,
        w: cardW - 0.28,
        h: 0.26,
        fontFace: FONT_FAMILY,
        fontSize: 10,
        bold: true,
        color: deltaColor,
      });
    }
  });
}

export function kpiCardFromGrowth(label: string, m: GrowthMetric, formatValue: (v: number) => string): KpiCardSpec {
  return {
    label,
    valueText: formatValue(m.current),
    deltaText: m.changePct != null ? formatPercent(m.changePct) + ' vs. prior period' : 'No prior-period baseline',
    deltaDirection: m.direction,
  };
}

export function addNativeTable(
  slide: pptxgen.Slide,
  headers: string[],
  rows: (string | number)[][],
  x: number,
  y: number,
  w: number,
): void {
  const headerRow: pptxgen.TableRow = headers.map((h) => ({
    text: h,
    options: { fill: { color: COLORS.navy }, color: 'FFFFFF', bold: true, fontSize: 10, fontFace: FONT_FAMILY },
  }));
  const bodyRows: pptxgen.TableRow[] = rows.map((row, i) =>
    row.map((cell) => ({
      text: String(cell),
      options: {
        fill: { color: i % 2 === 0 ? COLORS.paper : COLORS.offWhite },
        color: COLORS.ink,
        fontSize: 10,
        fontFace: FONT_FAMILY,
      },
    })),
  );

  slide.addTable([headerRow, ...bodyRows], {
    x,
    y,
    w,
    border: { type: 'solid', color: COLORS.border, pt: 0.5 },
    autoPage: false,
  });
}

export function addBarChart(
  slide: pptxgen.Slide,
  pptx: pptxgen,
  categories: string[],
  values: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  color = COLORS.indigo,
): void {
  slide.addChart(
    pptx.ChartType.bar,
    [{ name: 'Value', labels: categories, values }],
    { x, y, w, h, chartColors: [color], showLegend: false, showValue: false, barGapWidthPct: 40, catAxisLabelFontSize: 9, valAxisLabelFontSize: 9 },
  );
}

export function addLineChart(
  slide: pptxgen.Slide,
  pptx: pptxgen,
  categories: string[],
  series: { name: string; values: number[] }[],
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const chartData = series.map((s, i) => ({
    name: s.name,
    labels: categories,
    values: s.values,
  }));
  slide.addChart(pptx.ChartType.line, chartData, {
    x,
    y,
    w,
    h,
    chartColors: [COLORS.indigo, COLORS.cyan, COLORS.green],
    showLegend: series.length > 1,
    legendPos: 'b',
    lineDataSymbol: 'circle',
    lineSize: 2,
    catAxisLabelFontSize: 8,
    valAxisLabelFontSize: 9,
  });
}

export function addInsightCallout(slide: pptxgen.Slide, text: string, x: number, y: number, w: number, h: number): void {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, fill: { color: COLORS.lavenderTint }, line: { color: COLORS.lavender, width: 1 } });
  slide.addText(text, {
    x: x + 0.18,
    y: y + 0.12,
    w: w - 0.36,
    h: h - 0.24,
    fontFace: FONT_FAMILY,
    fontSize: 11,
    color: COLORS.ink,
    valign: 'middle',
  });
}

export function addRecommendationCard(
  slide: pptxgen.Slide,
  priority: 'high' | 'medium' | 'low',
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const priorityColor = priority === 'high' ? COLORS.red : priority === 'medium' ? COLORS.amber : COLORS.gray;
  slide.addShape('rect', { x, y, w: 0.06, h, fill: { color: priorityColor }, line: { type: 'none' } });
  slide.addShape('rect', { x: x + 0.06, y, w: w - 0.06, h, fill: { color: COLORS.offWhite }, line: { type: 'none' } });
  slide.addText(priority.toUpperCase(), {
    x: x + 0.2,
    y: y + 0.1,
    w: w - 0.4,
    h: 0.22,
    fontFace: FONT_FAMILY,
    fontSize: 8,
    bold: true,
    color: priorityColor,
    charSpacing: 1,
  });
  slide.addText(text, {
    x: x + 0.2,
    y: y + 0.32,
    w: w - 0.4,
    h: h - 0.42,
    fontFace: FONT_FAMILY,
    fontSize: 11,
    color: COLORS.ink,
    valign: 'top',
  });
}

export function addSectionDivider(pptx: pptxgen, sectionNumber: number, title: string, subtitle: string): pptxgen.Slide {
  const slide = pptx.addSlide();
  addBackground(slide, COLORS.navy);
  slide.addText(`SECTION ${String(sectionNumber).padStart(2, '0')}`, {
    x: MARGIN,
    y: 2.9,
    w: CONTENT_W,
    h: 0.35,
    fontFace: FONT_FAMILY,
    fontSize: 12,
    bold: true,
    color: COLORS.indigoLight,
    charSpacing: 2,
  });
  slide.addText(title, {
    x: MARGIN,
    y: 3.3,
    w: CONTENT_W,
    h: 1.1,
    fontFace: FONT_FAMILY,
    fontSize: 34,
    bold: true,
    color: COLORS.paper,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: MARGIN,
      y: 4.35,
      w: CONTENT_W * 0.7,
      h: 0.6,
      fontFace: FONT_FAMILY,
      fontSize: 13,
      color: COLORS.grayLight,
    });
  }
  slide.addShape('rect', { x: MARGIN, y: 2.75, w: 0.5, h: 0.06, fill: { color: COLORS.indigo }, line: { type: 'none' } });
  return slide;
}

export { formatCurrency };
