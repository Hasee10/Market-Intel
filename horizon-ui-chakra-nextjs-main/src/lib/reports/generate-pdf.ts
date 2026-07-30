'server-only';

import PDFDocument from 'pdfkit';

import type { ReportData } from './collect-report-data';
import { CHART_PALETTE, COLORS, formatCurrency, formatMetricName, formatPercent } from './design-tokens';

const IN = 72;
const W = 13.333 * IN;
const H = 7.5 * IN;
const MARGIN = 0.55 * IN;

function hex(c: string) {
  return `#${c}`;
}

function footer(doc: PDFKit.PDFDocument, businessName: string, pageLabel: string) {
  doc.rect(0, H - 0.32 * IN, W, 0.32 * IN).fill(hex(COLORS.offWhite));
  doc
    .fillColor(hex(COLORS.grayLight))
    .fontSize(8)
    .font('Helvetica')
    .text(`${businessName}  ·  Confidential`, MARGIN, H - 0.24 * IN, { lineBreak: false });
  doc.text(pageLabel, W - MARGIN - 150, H - 0.24 * IN, { width: 150, align: 'right', lineBreak: false });
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  doc.rect(MARGIN, 0.5 * IN, 4, 0.5 * IN).fill(hex(COLORS.indigo));
  doc
    .fillColor(hex(COLORS.ink))
    .font('Helvetica-Bold')
    .fontSize(22)
    .text(title, MARGIN + 14, 0.44 * IN);
  if (subtitle) {
    doc
      .fillColor(hex(COLORS.gray))
      .font('Helvetica')
      .fontSize(11)
      .text(subtitle, MARGIN + 14, 0.9 * IN);
  }
}

type Kpi = { label: string; value: string; accent: string };

function kpiCards(doc: PDFKit.PDFDocument, kpis: Kpi[], y: number, h = IN * 1.4) {
  const gap = 0.22 * IN;
  const cardW = (W - MARGIN * 2 - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (cardW + gap);
    doc
      .roundedRect(x, y, cardW, h, 8)
      .fillAndStroke(hex(COLORS.offWhite), hex(COLORS.border));
    doc.rect(x, y, 5, h).fill(hex(kpi.accent));
    doc
      .fillColor(hex(COLORS.ink))
      .font('Helvetica-Bold')
      .fontSize(20)
      .text(kpi.value, x + 16, y + h - 62, { width: cardW - 32 });
    doc
      .fillColor(hex(COLORS.gray))
      .font('Helvetica')
      .fontSize(10)
      .text(kpi.label, x + 16, y + h - 30, { width: cardW - 32 });
  });
}

function barChart(
  doc: PDFKit.PDFDocument,
  points: { label: string; value: number }[],
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const gap = 14;
  const barW = (w - gap * (points.length - 1)) / points.length;
  const chartH = h - 30;

  points.forEach((p, i) => {
    const barH = Math.max(2, (p.value / max) * chartH);
    const bx = x + i * (barW + gap);
    const by = y + chartH - barH;
    doc.roundedRect(bx, by, barW, barH, 4).fill(hex(color));
    doc
      .fillColor(hex(COLORS.ink))
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(formatCurrency(p.value), bx - 10, by - 14, { width: barW + 20, align: 'center' });
    doc
      .fillColor(hex(COLORS.gray))
      .font('Helvetica')
      .fontSize(9)
      .text(p.label, bx - 10, y + chartH + 6, { width: barW + 20, align: 'center' });
  });
  doc.moveTo(x, y + chartH).lineTo(x + w, y + chartH).strokeColor(hex(COLORS.border)).lineWidth(1).stroke();
}

function categoryBars(
  doc: PDFKit.PDFDocument,
  rows: { category: string; value: number }[],
  x: number,
  y: number,
  w: number,
) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const rowH = 34;
  rows.forEach((r, i) => {
    const ry = y + i * rowH;
    const color = CHART_PALETTE[i % CHART_PALETTE.length];
    doc
      .fillColor(hex(COLORS.ink))
      .font('Helvetica')
      .fontSize(10)
      .text(r.category, x, ry, { width: w * 0.35, lineBreak: false });
    const barMaxW = w * 0.5;
    const barW = Math.max(4, (r.value / max) * barMaxW);
    doc.roundedRect(x + w * 0.38, ry + 2, barMaxW, 10, 5).fill(hex(COLORS.border));
    doc.roundedRect(x + w * 0.38, ry + 2, barW, 10, 5).fill(hex(color));
    doc
      .fillColor(hex(COLORS.gray))
      .fontSize(9)
      .text(formatCurrency(r.value), x + w * 0.38 + barMaxW + 10, ry, { width: w * 0.12 });
  });
}

function table(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  x: number,
  y: number,
  w: number,
  colWidths: number[],
) {
  const rowH = 22;
  doc.rect(x, y, w, rowH).fill(hex(COLORS.indigo));
  let cx = x;
  headers.forEach((head, i) => {
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(head, cx + 8, y + 6, { width: colWidths[i] - 16, align: i === 0 ? 'left' : 'right' });
    cx += colWidths[i];
  });

  rows.forEach((row, ri) => {
    const ry = y + rowH * (ri + 1);
    doc.rect(x, ry, w, rowH).fill(hex(ri % 2 === 0 ? COLORS.paper : COLORS.offWhite));
    let colX = x;
    row.forEach((cell, ci) => {
      doc
        .fillColor(hex(COLORS.ink))
        .font('Helvetica')
        .fontSize(10)
        .text(cell, colX + 8, ry + 6, { width: colWidths[ci] - 16, align: ci === 0 ? 'left' : 'right' });
      colX += colWidths[ci];
    });
  });
  doc.rect(x, y, w, rowH * (rows.length + 1)).strokeColor(hex(COLORS.border)).lineWidth(0.5).stroke();
}

function newPage(doc: PDFKit.PDFDocument) {
  doc.addPage({ size: [W, H], margin: 0 });
}

// Mirrors generate-pptx.ts page-for-page so the PDF and PPTX read as the
// same report in two formats, not two different designs. pdfkit has no
// native chart support, so bar/category comparisons are drawn by hand with
// rects rather than pulled in via a charting dependency.
export async function generateReportPdf(data: ReportData): Promise<Buffer> {
  const doc = new PDFDocument({ size: [W, H], margin: 0, autoFirstPage: false, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const businessName = data.seller.businessName;

  // ===== 1. Cover =====
  newPage(doc);
  doc.rect(0, 0, W, H).fill(hex(COLORS.navy));
  const glow = doc.radialGradient(W - 1.2 * IN, 0.4 * IN, 0, W - 1.2 * IN, 0.4 * IN, 3.6 * IN);
  glow.stop(0, hex(COLORS.indigo), 0.35).stop(1, hex(COLORS.indigo), 0);
  doc.circle(W - 1.2 * IN, 0.4 * IN, 3.6 * IN).fill(glow);
  const glow2 = doc.radialGradient(0.5 * IN, H - 0.3 * IN, 0, 0.5 * IN, H - 0.3 * IN, 2.6 * IN);
  glow2.stop(0, hex(COLORS.indigoLight), 0.25).stop(1, hex(COLORS.indigoLight), 0);
  doc.circle(0.5 * IN, H - 0.3 * IN, 2.6 * IN).fill(glow2);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16).text('RYVL', MARGIN, 0.5 * IN);
  doc
    .fillColor(hex(COLORS.cyan))
    .font('Helvetica-Bold')
    .fontSize(13)
    .text('MARKET INTELLIGENCE REPORT', MARGIN, 2.6 * IN);
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(38)
    .text(businessName, MARGIN, 3.05 * IN, { width: 10 * IN });
  doc
    .fillColor(hex(COLORS.grayLight))
    .font('Helvetica')
    .fontSize(15)
    .text(data.domainName ?? 'General e-commerce', MARGIN, 4.15 * IN);
  doc.rect(MARGIN, 4.75 * IN, 1.4 * IN, 2).fill(hex(COLORS.indigo));
  doc
    .fillColor(hex(COLORS.grayLight))
    .fontSize(10.5)
    .text(`${data.periodLabel}  ·  Prepared ${new Date().toLocaleDateString()}`, MARGIN, H - 0.85 * IN);
  doc
    .fillColor('#5B6796')
    .fontSize(9)
    .text('Prepared for internal review and client sharing', MARGIN, H - 0.55 * IN);

  // ===== 2. Executive summary =====
  newPage(doc);
  sectionHeader(doc, 'Executive summary', data.periodLabel);
  doc.roundedRect(MARGIN, 1.35 * IN, W - MARGIN * 2, 1.5 * IN, 8).fill(hex(COLORS.navyLight));
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica')
    .fontSize(13)
    .text(
      data.insights.summary ||
        `${businessName} generated ${formatCurrency(data.revenue)} across ${data.orderCount} orders over the last 30 days.`,
      MARGIN + 25,
      1.55 * IN,
      { width: W - MARGIN * 2 - 50, lineGap: 6 },
    );

  const highlights = data.insights.highlights.length > 0 ? data.insights.highlights : null;
  let kpiY = 3.15 * IN;
  if (highlights) {
    const gap = 0.3 * IN;
    const cardW = (W - MARGIN * 2 - gap * (highlights.length - 1)) / highlights.length;
    highlights.forEach((h, i) => {
      const x = MARGIN + i * (cardW + gap);
      doc.roundedRect(x, 3.15 * IN, cardW, 1.3 * IN, 8).fillAndStroke(hex(COLORS.offWhite), hex(COLORS.border));
      doc.circle(x + 18, 3.15 * IN + 18, 6).fill(hex(CHART_PALETTE[i % CHART_PALETTE.length]));
      doc
        .fillColor(hex(COLORS.ink))
        .font('Helvetica')
        .fontSize(11)
        .text(h, x + 16, 3.15 * IN + 36, { width: cardW - 32 });
    });
    kpiY = 4.7 * IN;
  }
  kpiCards(
    doc,
    [
      { label: 'Revenue (30d)', value: formatCurrency(data.revenue), accent: COLORS.indigo },
      { label: 'Orders (30d)', value: String(data.orderCount), accent: COLORS.cyan },
      { label: 'Active products', value: String(data.activeProductCount), accent: COLORS.green },
    ],
    kpiY,
  );
  footer(doc, businessName, 'Page 2');

  // ===== 3. Store performance =====
  newPage(doc);
  sectionHeader(doc, 'Store performance', data.periodLabel);
  kpiCards(
    doc,
    [
      { label: 'Revenue', value: formatCurrency(data.revenue), accent: COLORS.indigo },
      { label: 'Orders', value: String(data.orderCount), accent: COLORS.cyan },
      { label: 'Average order value', value: formatCurrency(data.avgOrderValue), accent: COLORS.green },
      { label: 'Active products', value: String(data.activeProductCount), accent: COLORS.amber },
    ],
    1.35 * IN,
    1.15 * IN,
  );
  if (data.weeklyRevenue.some((w) => w.revenue > 0)) {
    doc
      .fillColor(hex(COLORS.ink))
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Revenue by week', MARGIN, 3.05 * IN);
    barChart(
      doc,
      data.weeklyRevenue.map((w) => ({ label: w.label, value: w.revenue })),
      MARGIN,
      3.45 * IN,
      W - MARGIN * 2,
      3 * IN,
      COLORS.indigo,
    );
  }
  footer(doc, businessName, 'Page 3');

  // ===== 4. Products & category mix =====
  if (data.topProducts.length > 0 || data.categoryBreakdown.length > 0) {
    newPage(doc);
    sectionHeader(doc, 'Products & inventory mix');
    if (data.topProducts.length > 0) {
      doc
        .fillColor(hex(COLORS.ink))
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Top products by inventory value', MARGIN, 1.3 * IN);
      const colWidths = [3.4 * IN, 1.6 * IN];
      table(
        doc,
        ['Product', 'Inventory value'],
        data.topProducts.map((p) => [p.title, formatCurrency(p.inventoryValue)]),
        MARGIN,
        1.65 * IN,
        colWidths[0] + colWidths[1],
        colWidths,
      );
    }
    if (data.categoryBreakdown.length > 0) {
      doc
        .fillColor(hex(COLORS.ink))
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Inventory value by category', 7.9 * IN, 1.3 * IN);
      categoryBars(doc, data.categoryBreakdown, 7.9 * IN, 1.75 * IN, 4.9 * IN);
    }
    footer(doc, businessName, 'Page 4');
  }

  // ===== 5. Market position =====
  if (data.benchmarks.length > 0 || data.categoryPricing) {
    newPage(doc);
    sectionHeader(doc, 'Market position', data.domainName ?? undefined);
    let cursorY = 1.35 * IN;
    if (data.categoryPricing) {
      kpiCards(
        doc,
        [
          { label: 'Category P25', value: formatCurrency(data.categoryPricing.p25), accent: COLORS.cyan },
          { label: 'Category median', value: formatCurrency(data.categoryPricing.median), accent: COLORS.indigo },
          { label: 'Category P75', value: formatCurrency(data.categoryPricing.p75), accent: COLORS.amber },
          { label: 'Listings tracked', value: String(data.categoryPricing.count), accent: COLORS.green },
        ],
        cursorY,
        1.15 * IN,
      );
      cursorY += 1.65 * IN;
    }
    if (data.benchmarks.length > 0) {
      doc
        .fillColor(hex(COLORS.ink))
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Peer benchmarks in your domain', MARGIN, cursorY);
      const colWidths = [5 * IN, 1.6 * IN, 1.6 * IN];
      table(
        doc,
        ['Metric', 'Median', 'Sample size'],
        data.benchmarks.map((b) => [formatMetricName(b.metricName), b.median != null ? String(b.median) : '-', String(b.sampleSize)]),
        MARGIN,
        cursorY + 0.35 * IN,
        colWidths.reduce((a, b) => a + b, 0),
        colWidths,
      );
    }
    footer(doc, businessName, 'Page 5');
  }

  // ===== 6. Customer retention =====
  if (data.churn) {
    newPage(doc);
    sectionHeader(doc, 'Customer retention');
    kpiCards(
      doc,
      [
        { label: 'Retention rate', value: formatPercent(data.churn.retentionRate), accent: COLORS.green },
        { label: 'Repeat purchase rate', value: formatPercent(data.churn.repeatPurchaseRate), accent: COLORS.indigo },
        {
          label: 'Avg. customer value',
          value: data.churn.avgClv != null ? formatCurrency(data.churn.avgClv) : '-',
          accent: COLORS.amber,
        },
      ],
      1.35 * IN,
      1.4 * IN,
    );
    footer(doc, businessName, 'Page 6');
  }

  doc.end();
  return done;
}
