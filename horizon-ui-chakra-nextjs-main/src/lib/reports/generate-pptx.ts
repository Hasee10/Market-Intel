'server-only';

import PptxGenJS from 'pptxgenjs';

import type { ReportData } from './collect-report-data';
import { CHART_PALETTE, COLORS, formatCurrency, formatMetricName, formatPercent } from './design-tokens';

const W = 13.333;
const H = 7.5;
const MARGIN = 0.55;

type Kpi = { label: string; value: string; accent: string };

function drawFooter(slide: PptxGenJS.Slide, businessName: string, pageLabel: string) {
  slide.addShape('rect', { x: 0, y: H - 0.32, w: W, h: 0.32, fill: { color: COLORS.offWhite } });
  slide.addText(`${businessName}  ·  Confidential`, {
    x: MARGIN,
    y: H - 0.32,
    w: 6,
    h: 0.32,
    fontSize: 8,
    color: COLORS.grayLight,
    valign: 'middle',
  });
  slide.addText(pageLabel, {
    x: W - MARGIN - 3,
    y: H - 0.32,
    w: 3,
    h: 0.32,
    fontSize: 8,
    color: COLORS.grayLight,
    align: 'right',
    valign: 'middle',
  });
}

function drawSectionHeader(slide: PptxGenJS.Slide, title: string, subtitle?: string) {
  slide.addShape('rect', { x: MARGIN, y: 0.5, w: 0.06, h: 0.5, fill: { color: COLORS.indigo } });
  slide.addText(title, {
    x: MARGIN + 0.2,
    y: 0.42,
    w: W - MARGIN * 2 - 0.2,
    h: 0.5,
    fontSize: 24,
    bold: true,
    color: COLORS.ink,
    fontFace: 'Arial',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: MARGIN + 0.2,
      y: 0.92,
      w: W - MARGIN * 2 - 0.2,
      h: 0.3,
      fontSize: 11,
      color: COLORS.gray,
    });
  }
}

function drawKpiCards(slide: PptxGenJS.Slide, kpis: Kpi[], y: number, h = 1.5) {
  const gap = 0.25;
  const cardW = (W - MARGIN * 2 - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (cardW + gap);
    slide.addShape('roundRect', {
      x,
      y,
      w: cardW,
      h,
      rectRadius: 0.08,
      fill: { color: COLORS.offWhite },
      line: { color: COLORS.border, width: 1 },
    });
    slide.addShape('rect', { x, y, w: 0.06, h, fill: { color: kpi.accent } });
    slide.addText(kpi.value, {
      x: x + 0.2,
      y: y + 0.18,
      w: cardW - 0.4,
      h: h - 0.7,
      fontSize: 22,
      bold: true,
      color: COLORS.ink,
      fontFace: 'Arial',
      valign: 'bottom',
    });
    slide.addText(kpi.label, {
      x: x + 0.2,
      y: y + h - 0.48,
      w: cardW - 0.4,
      h: 0.4,
      fontSize: 10.5,
      color: COLORS.gray,
    });
  });
}

// Faked "gradient" for the cover - pptxgenjs shape fills are solid-only, so
// depth comes from layering a few large, low-opacity circles instead of a
// real CSS-style gradient.
function drawCoverBackdrop(slide: PptxGenJS.Slide) {
  slide.background = { color: COLORS.navy };
  slide.addShape('ellipse', {
    x: W - 5,
    y: -2.5,
    w: 7,
    h: 7,
    fill: { color: COLORS.indigo, transparency: 78 },
    line: { type: 'none' },
  });
  slide.addShape('ellipse', {
    x: W - 3.2,
    y: -1,
    w: 4.5,
    h: 4.5,
    fill: { color: COLORS.cyan, transparency: 82 },
    line: { type: 'none' },
  });
  slide.addShape('ellipse', {
    x: -2,
    y: H - 3,
    w: 5,
    h: 5,
    fill: { color: COLORS.indigoLight, transparency: 85 },
    line: { type: 'none' },
  });
}

// Builds a client-shareable summary deck from a seller's own dashboard
// numbers - meant for a researcher/analyst to review and hand off, not a
// raw data dump. Every visual element (KPI cards, charts, footer, section
// rule) is drawn from lib/reports/design-tokens.ts so the PDF version stays
// visually consistent with this one.
export async function generateReportPptx(data: ReportData): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'RYVL_WIDE', width: W, height: H });
  pptx.layout = 'RYVL_WIDE';
  pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };

  const businessName = data.seller.businessName;

  // ===== 1. Cover =====
  const cover = pptx.addSlide();
  drawCoverBackdrop(cover);
  cover.addText('RYVL', { x: MARGIN, y: 0.5, w: 3, h: 0.4, fontSize: 16, bold: true, color: 'FFFFFF', charSpacing: 2 });
  cover.addText('MARKET INTELLIGENCE REPORT', {
    x: MARGIN,
    y: 2.6,
    w: 10,
    h: 0.4,
    fontSize: 13,
    color: COLORS.cyan,
    charSpacing: 2,
    bold: true,
  });
  cover.addText(businessName, {
    x: MARGIN,
    y: 3.05,
    w: 11,
    h: 1.2,
    fontSize: 40,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial',
  });
  cover.addText(data.domainName ?? 'General e-commerce', {
    x: MARGIN,
    y: 4.15,
    w: 10,
    h: 0.4,
    fontSize: 15,
    color: COLORS.grayLight,
  });
  cover.addShape('rect', { x: MARGIN, y: 4.75, w: 1.4, h: 0.03, fill: { color: COLORS.indigo } });
  cover.addText(`${data.periodLabel}  ·  Prepared ${new Date().toLocaleDateString()}`, {
    x: MARGIN,
    y: H - 0.85,
    w: 8,
    h: 0.35,
    fontSize: 10.5,
    color: COLORS.grayLight,
  });
  cover.addText('Prepared for internal review and client sharing', {
    x: MARGIN,
    y: H - 0.55,
    w: 8,
    h: 0.3,
    fontSize: 9,
    color: '5B6796',
  });

  // ===== 2. Executive summary =====
  const summary = pptx.addSlide();
  drawSectionHeader(summary, 'Executive summary', data.periodLabel);
  summary.addShape('roundRect', {
    x: MARGIN,
    y: 1.35,
    w: W - MARGIN * 2,
    h: 1.5,
    rectRadius: 0.08,
    fill: { color: COLORS.navyLight },
    line: { type: 'none' },
  });
  summary.addText(
    data.insights.summary ||
      `${businessName} generated ${formatCurrency(data.revenue)} across ${data.orderCount} orders over the last 30 days.`,
    {
      x: MARGIN + 0.35,
      y: 1.55,
      w: W - MARGIN * 2 - 0.7,
      h: 1.1,
      fontSize: 14,
      color: 'FFFFFF',
      valign: 'middle',
      lineSpacing: 22,
    },
  );

  const highlightY = 3.15;
  const highlights = data.insights.highlights.length > 0 ? data.insights.highlights : null;
  if (highlights) {
    const gap = 0.3;
    const cardW = (W - MARGIN * 2 - gap * (highlights.length - 1)) / highlights.length;
    highlights.forEach((h, i) => {
      const x = MARGIN + i * (cardW + gap);
      summary.addShape('roundRect', {
        x,
        y: highlightY,
        w: cardW,
        h: 1.3,
        rectRadius: 0.08,
        fill: { color: COLORS.offWhite },
        line: { color: COLORS.border, width: 1 },
      });
      summary.addShape('ellipse', { x: x + 0.25, y: highlightY + 0.25, w: 0.14, h: 0.14, fill: { color: CHART_PALETTE[i % CHART_PALETTE.length] } });
      summary.addText(h, {
        x: x + 0.25,
        y: highlightY + 0.5,
        w: cardW - 0.5,
        h: 0.75,
        fontSize: 12,
        color: COLORS.ink,
        valign: 'top',
      });
    });
  }
  drawKpiCards(
    summary,
    [
      { label: 'Revenue (30d)', value: formatCurrency(data.revenue), accent: COLORS.indigo },
      { label: 'Orders (30d)', value: String(data.orderCount), accent: COLORS.cyan },
      { label: 'Active products', value: String(data.activeProductCount), accent: COLORS.green },
    ],
    highlights ? 4.7 : 3.15,
  );
  drawFooter(summary, businessName, 'Page 2');

  // ===== 3. Store performance =====
  const perf = pptx.addSlide();
  drawSectionHeader(perf, 'Store performance', data.periodLabel);
  drawKpiCards(
    perf,
    [
      { label: 'Revenue', value: formatCurrency(data.revenue), accent: COLORS.indigo },
      { label: 'Orders', value: String(data.orderCount), accent: COLORS.cyan },
      { label: 'Average order value', value: formatCurrency(data.avgOrderValue), accent: COLORS.green },
      { label: 'Active products', value: String(data.activeProductCount), accent: COLORS.amber },
    ],
    1.35,
    1.3,
  );

  if (data.weeklyRevenue.some((w) => w.revenue > 0)) {
    perf.addText('Revenue by week', { x: MARGIN, y: 3.1, w: 6, h: 0.35, fontSize: 12, bold: true, color: COLORS.ink });
    perf.addChart(
      pptx.ChartType.bar,
      [{ name: 'Revenue', labels: data.weeklyRevenue.map((w) => w.label), values: data.weeklyRevenue.map((w) => w.revenue) }],
      {
        x: MARGIN,
        y: 3.5,
        w: W - MARGIN * 2,
        h: 3.1,
        chartColors: [COLORS.indigo],
        barDir: 'col',
        showLegend: false,
        showValue: false,
        catAxisLabelColor: COLORS.gray,
        valAxisLabelColor: COLORS.gray,
        catAxisLineColor: COLORS.border,
        valAxisLineColor: COLORS.border,
        valGridLine: { color: COLORS.border },
        dataBorder: { pt: 0, color: COLORS.indigo },
      },
    );
  }
  drawFooter(perf, businessName, 'Page 3');

  // ===== 4. Products & category mix =====
  if (data.topProducts.length > 0 || data.categoryBreakdown.length > 0) {
    const products = pptx.addSlide();
    drawSectionHeader(products, 'Products & inventory mix');

    if (data.topProducts.length > 0) {
      products.addText('Top products by inventory value', {
        x: MARGIN,
        y: 1.3,
        w: 7,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: COLORS.ink,
      });
      const rows: PptxGenJS.TableRow[] = [
        [
          { text: 'Product', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.indigo }, fontSize: 11 } },
          {
            text: 'Inventory value',
            options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.indigo }, fontSize: 11, align: 'right' },
          },
        ],
        ...data.topProducts.map((p, i) => [
          { text: p.title, options: { fill: { color: i % 2 === 0 ? COLORS.paper : COLORS.offWhite }, fontSize: 11 } },
          {
            text: formatCurrency(p.inventoryValue),
            options: { fill: { color: i % 2 === 0 ? COLORS.paper : COLORS.offWhite }, fontSize: 11, align: 'right' as const },
          },
        ]),
      ];
      products.addTable(rows, { x: MARGIN, y: 1.65, w: 7, fontSize: 11, autoPage: false, border: { pt: 0.5, color: COLORS.border } });
    }

    if (data.categoryBreakdown.length > 0) {
      products.addText('Inventory value by category', {
        x: 7.9,
        y: 1.3,
        w: 4.9,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: COLORS.ink,
      });
      products.addChart(
        pptx.ChartType.doughnut,
        [
          {
            name: 'Category value',
            labels: data.categoryBreakdown.map((c) => c.category),
            values: data.categoryBreakdown.map((c) => c.value),
          },
        ],
        {
          x: 7.7,
          y: 1.6,
          w: 5.1,
          h: 4.6,
          chartColors: CHART_PALETTE,
          showLegend: true,
          legendPos: 'b',
          legendColor: COLORS.gray,
          legendFontSize: 9,
          dataLabelColor: 'FFFFFF',
        },
      );
    }
    drawFooter(products, businessName, 'Page 4');
  }

  // ===== 5. Market position =====
  if (data.benchmarks.length > 0 || data.categoryPricing) {
    const market = pptx.addSlide();
    drawSectionHeader(market, 'Market position', data.domainName ?? undefined);

    let cursorY = 1.35;
    if (data.categoryPricing) {
      drawKpiCards(
        market,
        [
          { label: 'Category P25', value: formatCurrency(data.categoryPricing.p25), accent: COLORS.cyan },
          { label: 'Category median', value: formatCurrency(data.categoryPricing.median), accent: COLORS.indigo },
          { label: 'Category P75', value: formatCurrency(data.categoryPricing.p75), accent: COLORS.amber },
          { label: 'Listings tracked', value: String(data.categoryPricing.count), accent: COLORS.green },
        ],
        cursorY,
        1.3,
      );
      cursorY += 1.65;
    }

    if (data.benchmarks.length > 0) {
      market.addText('Peer benchmarks in your domain', {
        x: MARGIN,
        y: cursorY,
        w: W - MARGIN * 2,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: COLORS.ink,
      });
      const rows: PptxGenJS.TableRow[] = [
        [
          { text: 'Metric', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.indigo }, fontSize: 11 } },
          { text: 'Median', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.indigo }, fontSize: 11, align: 'right' } },
          {
            text: 'Sample size',
            options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.indigo }, fontSize: 11, align: 'right' },
          },
        ],
        ...data.benchmarks.map((b, i) => [
          { text: formatMetricName(b.metricName), options: { fill: { color: i % 2 === 0 ? COLORS.paper : COLORS.offWhite }, fontSize: 11 } },
          {
            text: b.median != null ? String(b.median) : '-',
            options: { fill: { color: i % 2 === 0 ? COLORS.paper : COLORS.offWhite }, fontSize: 11, align: 'right' as const },
          },
          {
            text: String(b.sampleSize),
            options: { fill: { color: i % 2 === 0 ? COLORS.paper : COLORS.offWhite }, fontSize: 11, align: 'right' as const },
          },
        ]),
      ];
      market.addTable(rows, { x: MARGIN, y: cursorY + 0.35, w: W - MARGIN * 2, fontSize: 11, autoPage: false, border: { pt: 0.5, color: COLORS.border } });
    }
    drawFooter(market, businessName, 'Page 5');
  }

  // ===== 6. Customer retention =====
  if (data.churn) {
    const retention = pptx.addSlide();
    drawSectionHeader(retention, 'Customer retention');
    drawKpiCards(
      retention,
      [
        { label: 'Retention rate', value: formatPercent(data.churn.retentionRate), accent: COLORS.green },
        { label: 'Repeat purchase rate', value: formatPercent(data.churn.repeatPurchaseRate), accent: COLORS.indigo },
        {
          label: 'Avg. customer value',
          value: data.churn.avgClv != null ? formatCurrency(data.churn.avgClv) : '-',
          accent: COLORS.amber,
        },
      ],
      1.35,
      1.6,
    );
    drawFooter(retention, businessName, 'Page 6');
  }

  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return buffer;
}
