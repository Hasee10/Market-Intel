'server-only';

import PDFDocument from 'pdfkit';
import type { ReportSnapshot } from '../../schema';
import { buildSectionPlan, type PlannedSection, ROWS_PER_TABLE_PAGE } from '../../section-plan';
import { COLORS, formatCurrency, formatDate, formatPercent } from '../../design-tokens';

const IN = 72;
const W = 13.333 * IN;
const H = 7.5 * IN;
const MARGIN = 0.58 * IN;
const CONTENT_W = W - MARGIN * 2;

const hex = (c: string) => `#${c}`;

// Mirrors build-deck.ts's section-driven structure exactly - same
// ReportSnapshot, same section plan, same visual language (design-tokens.ts)
// - so the two formats satisfy "both formats must come from the same
// structured report data" without needing to share rendering code (see
// docs/reports-v2-architecture.md §6's Option A rationale). Native vector
// PDF throughout: no rasterized charts, pdfkit draws bars/lines directly.
export async function buildReportPdf(snapshot: ReportSnapshot): Promise<Buffer> {
  const plan = buildSectionPlan(snapshot);
  const doc = new PDFDocument({ size: [W, H], margin: 0, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  let slideIndex = 0;
  const nextLabel = (section: PlannedSection) => {
    slideIndex += 1;
    return section.pageCount > 1 ? `Slide ${slideIndex} · ${section.page + 1}/${section.pageCount}` : `Slide ${slideIndex}`;
  };

  for (const section of plan.sections) {
    doc.addPage({ size: [W, H], margin: 0 });
    switch (section.kind) {
      case 'cover':
        slideIndex += 1;
        renderCover(doc, snapshot);
        break;
      case 'executive_snapshot':
        renderExecutiveSnapshot(doc, snapshot, section, nextLabel(section));
        break;
      case 'market_position':
        renderMarketPosition(doc, snapshot, section, nextLabel(section));
        break;
      case 'pricing_intelligence':
        renderPricingIntelligence(doc, snapshot, section, nextLabel(section));
        break;
      case 'competitor_tracking':
        renderCompetitorTracking(doc, snapshot, section, nextLabel(section));
        break;
      case 'sku_performance':
        renderSkuPerformance(doc, snapshot, section, nextLabel(section));
        break;
      case 'inventory_risk':
        renderInventoryRisk(doc, snapshot, section, nextLabel(section));
        break;
      case 'portfolio_contribution':
        renderPortfolio(doc, snapshot, section, nextLabel(section));
        break;
      case 'customer_health':
        renderCustomerHealth(doc, snapshot, section, nextLabel(section));
        break;
      case 'recommendations':
        renderRecommendations(doc, snapshot, section, nextLabel(section));
        break;
      case 'roadmap':
        renderRoadmap(doc, snapshot, section, nextLabel(section));
        break;
      case 'methodology':
        renderMethodology(doc, snapshot, section, nextLabel(section));
        break;
      case 'appendix':
        renderAppendix(doc, snapshot, section, nextLabel(section));
        break;
    }
  }

  doc.end();
  return done;
}

function header(doc: PDFKit.PDFDocument, title: string, subtitle: string, label: string) {
  doc.fillColor(hex(COLORS.indigo)).font('Helvetica-Bold').fontSize(12).text('Ryvl', MARGIN, 0.32 * IN, { lineBreak: false });
  doc
    .fillColor(hex(COLORS.grayLight))
    .font('Helvetica')
    .fontSize(10)
    .text(label, W - MARGIN - 150, 0.32 * IN, { width: 150, align: 'right', lineBreak: false });
  doc.fillColor(hex(COLORS.navy)).font('Helvetica-Bold').fontSize(22).text(title, MARGIN, 0.68 * IN, { width: CONTENT_W });
  if (subtitle) {
    doc.fillColor(hex(COLORS.gray)).font('Helvetica').fontSize(11).text(subtitle, MARGIN, 1.14 * IN, { width: CONTENT_W });
  }
  doc.moveTo(MARGIN, 1.55 * IN).lineTo(W - MARGIN, 1.55 * IN).strokeColor(hex(COLORS.border)).lineWidth(1).stroke();
}

function footer(doc: PDFKit.PDFDocument, sourceText: string, mode: ReportSnapshot['metadata']['mode']) {
  doc.fillColor(hex(COLORS.grayLight)).font('Helvetica-Oblique').fontSize(8).text(sourceText, MARGIN, H - 0.42 * IN, { width: CONTENT_W - 160, lineBreak: false });
  const label = mode === 'internal' ? 'Internal - not for distribution' : 'Confidential';
  doc
    .fillColor(mode === 'internal' ? hex(COLORS.red) : hex(COLORS.gray))
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(label, W - MARGIN - 160, H - 0.42 * IN, { width: 160, align: 'right', lineBreak: false });
}

function sourceLine(snapshot: ReportSnapshot): string {
  return `Source: ${snapshot.methodology.dataSources.map((s) => s.name).join(' - ')} - Generated ${formatDate(snapshot.metadata.generatedAt)}`;
}

interface KpiSpec { label: string; value: string; delta?: string; deltaColor?: string }

function kpiRow(doc: PDFKit.PDFDocument, cards: KpiSpec[], y: number) {
  if (cards.length === 0) return;
  const gap = 0.16 * IN;
  const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const h = 1.15 * IN;
  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardW + gap);
    doc.roundedRect(x, y, cardW, h, 6).fill(hex(COLORS.lavenderTint));
    doc.fillColor(hex(COLORS.gray)).font('Helvetica-Bold').fontSize(9).text(card.label.toUpperCase(), x + 12, y + 12, { width: cardW - 24 });
    doc.fillColor(hex(COLORS.navy)).font('Helvetica-Bold').fontSize(20).text(card.value, x + 12, y + 34, { width: cardW - 24 });
    if (card.delta) {
      doc.fillColor(card.deltaColor ?? hex(COLORS.grayLight)).font('Helvetica-Bold').fontSize(9).text(card.delta, x + 12, y + h - 26, { width: cardW - 24 });
    }
  });
}

function table(doc: PDFKit.PDFDocument, headers: string[], rows: (string | number)[][], x: number, y: number, w: number) {
  const colW = w / headers.length;
  const rowH = 0.34 * IN;
  doc.rect(x, y, w, rowH).fill(hex(COLORS.navy));
  headers.forEach((h, i) => {
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(h, x + i * colW + 8, y + 10, { width: colW - 16 });
  });
  rows.forEach((row, r) => {
    const rowY = y + rowH * (r + 1);
    doc.rect(x, rowY, w, rowH).fill(r % 2 === 0 ? hex(COLORS.paper) : hex(COLORS.offWhite));
    row.forEach((cell, c) => {
      doc.fillColor(hex(COLORS.ink)).font('Helvetica').fontSize(10).text(String(cell), x + c * colW + 8, rowY + 10, { width: colW - 16 });
    });
  });
  doc.rect(x, y, w, rowH * (rows.length + 1)).strokeColor(hex(COLORS.border)).lineWidth(0.5).stroke();
}

function barChart(doc: PDFKit.PDFDocument, categories: string[], values: number[], x: number, y: number, w: number, h: number, color = COLORS.indigo) {
  const max = Math.max(...values, 1);
  const gap = 0.15 * IN;
  const barW = (w - gap * (categories.length - 1)) / categories.length;
  categories.forEach((cat, i) => {
    const barH = (values[i] / max) * (h - 0.3 * IN);
    const barX = x + i * (barW + gap);
    doc.rect(barX, y + h - 0.3 * IN - barH, barW, barH).fill(hex(color));
    doc.fillColor(hex(COLORS.ink)).font('Helvetica').fontSize(9).text(cat, barX, y + h - 0.26 * IN, { width: barW, align: 'center' });
    doc.fillColor(hex(COLORS.gray)).fontSize(8).text(values[i].toFixed(0), barX, y + h - 0.3 * IN - barH - 12, { width: barW, align: 'center' });
  });
}

// -- Section renderers (mirror build-deck.ts 1:1 in coverage) --------------

function renderCover(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot) {
  doc.rect(0, 0, W, H).fill(hex(COLORS.navy));
  doc.fillColor(hex(COLORS.indigo)).font('Helvetica-Bold').fontSize(16).text('Ryvl', MARGIN, 0.5 * IN);
  doc.fillColor(hex(COLORS.grayLight)).font('Helvetica').fontSize(10).text(`Ref: ${snapshot.metadata.reportId.slice(0, 8).toUpperCase()}`, W - MARGIN - 200, 0.5 * IN, { width: 200, align: 'right' });
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(38).text(snapshot.workspace.businessName, MARGIN, 2.6 * IN, { width: CONTENT_W });
  const subtitle =
    snapshot.workspace.categories.length > 0
      ? `Market intelligence for ${snapshot.workspace.categories.map((c) => c.name).join(', ')}`
      : 'Seller market intelligence report';
  doc.fillColor(hex(COLORS.grayLight)).font('Helvetica').fontSize(14).text(subtitle, MARGIN, 3.85 * IN, { width: CONTENT_W });
  doc.fillColor(hex(COLORS.gray)).fontSize(10).text(`Period: ${snapshot.metadata.period.label}  ·  Generated ${formatDate(snapshot.metadata.generatedAt)}`, MARGIN, H - 1.1 * IN);
}

function renderExecutiveSnapshot(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, label: string) {
  header(doc, 'Executive Snapshot & Key Signals', snapshot.metadata.period.label, label);
  const currency = snapshot.workspace.reportingCurrency;
  const cards: KpiSpec[] = [];
  if (snapshot.revenue) {
    cards.push({
      label: 'Revenue',
      value: formatCurrency(snapshot.revenue.revenue.current, currency),
      delta: snapshot.revenue.revenue.changePct != null ? formatPercent(snapshot.revenue.revenue.changePct) : 'No baseline',
      deltaColor: snapshot.revenue.revenue.direction === 'up' ? hex(COLORS.green) : snapshot.revenue.revenue.direction === 'down' ? hex(COLORS.red) : undefined,
    });
    cards.push({ label: 'Orders', value: String(Math.round(snapshot.revenue.orders.current)) });
  }
  if (snapshot.marketplacePerformance?.priceIndex) {
    cards.push({ label: 'Price Index', value: snapshot.marketplacePerformance.priceIndex.value.toFixed(0), delta: '100 = at median' });
  }
  if (snapshot.inventoryRisk) {
    cards.push({ label: 'Stockout Risk SKUs', value: String(snapshot.inventoryRisk.lowStockSkuCount) });
  }
  kpiRow(doc, cards, 1.85 * IN);

  let y = 3.25 * IN;
  const narrative = snapshot.appendix?.aiSummary as string | undefined;
  if (narrative) {
    doc.roundedRect(MARGIN, y, CONTENT_W, 0.9 * IN, 6).fillAndStroke(hex(COLORS.lavenderTint), hex(COLORS.lavender));
    doc.fillColor(hex(COLORS.ink)).font('Helvetica').fontSize(11).text(narrative, MARGIN + 12, y + 12, { width: CONTENT_W - 24 });
    y += 1.05 * IN;
  }
  const signals = snapshot.marketSignals.slice(0, 3);
  if (signals.length > 0) {
    doc.fillColor(hex(COLORS.gray)).font('Helvetica-Bold').fontSize(10).text('WHAT CHANGED THIS CYCLE', MARGIN, y);
    signals.forEach((s, i) => {
      doc.fillColor(hex(COLORS.ink)).font('Helvetica').fontSize(11).text(`•  ${s.description}`, MARGIN, y + 24 + i * 22, { width: CONTENT_W });
    });
  }
  footer(doc, sourceLine(snapshot), snapshot.metadata.mode);
}

function renderMarketPosition(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, label: string) {
  const mp = snapshot.marketplacePerformance;
  if (!mp) return;
  header(doc, 'Market Position & Benchmark Percentiles', `Scope: ${mp.scope.platformNames.join(', ') || 'tracked marketplaces'}`, label);
  if (mp.priceIndex) {
    kpiRow(doc, [{ label: 'Price Index vs. Market', value: mp.priceIndex.value.toFixed(0), delta: '100 = at market median' }], 1.85 * IN);
  }
  if (snapshot.pricePositioning?.percentile != null) {
    barChart(doc, ['P25', 'Your position', 'P75'], [25, snapshot.pricePositioning.percentile, 75], MARGIN, 3.2 * IN, CONTENT_W, 3.4 * IN);
  }
  footer(doc, sourceLine(snapshot), snapshot.metadata.mode);
}

function renderPricingIntelligence(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, label: string) {
  const pp = snapshot.pricePositioning;
  if (!pp) return;
  header(doc, 'Pricing Intelligence', 'Your price vs. the tracked market', label);
  const currency = snapshot.workspace.reportingCurrency;
  const cards: KpiSpec[] = [
    { label: 'Your Current Price', value: formatCurrency(pp.yourMedianPrice.value, currency) },
    { label: 'Market Median', value: formatCurrency(pp.marketMedian.value, currency) },
  ];
  if (pp.recommendedBand) {
    cards.push({ label: 'Recommended Band', value: `${formatCurrency(pp.recommendedBand.low, currency)} - ${formatCurrency(pp.recommendedBand.high, currency)}` });
  }
  kpiRow(doc, cards, 1.85 * IN);
  if (pp.trend && pp.trend.length >= 2) {
    barChart(doc, pp.trend.map((t) => formatDate(t.date)), pp.trend.map((t) => t.medianPrice), MARGIN, 3.25 * IN, CONTENT_W, 3.35 * IN);
  }
  footer(doc, sourceLine(snapshot), snapshot.metadata.mode);
}

function renderCompetitorTracking(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, label: string) {
  const cb = snapshot.competitorBenchmarks;
  if (!cb || !section.rowRange) return;
  header(doc, section.title, cb.marketDefinitionSummary, label);
  const currency = snapshot.workspace.reportingCurrency;
  const rows = cb.scorecards.slice(section.rowRange[0], section.rowRange[1]);
  table(
    doc,
    ['Competitor', 'Platform', 'SKUs', 'Median Price', 'In Stock', 'Repricing Rate'],
    rows.map((r) => [r.competitorName, r.platformName, r.skuCount, formatCurrency(r.medianPrice.value, currency), formatPercent(r.inStockRate * 100, 0), r.repricingRate != null ? formatPercent(r.repricingRate * 100, 0) : 'N/A']),
    MARGIN,
    1.85 * IN,
    CONTENT_W,
  );
  if (section.truncated) {
    doc.fillColor(hex(COLORS.gray)).font('Helvetica-Oblique').fontSize(10).text(`+${section.truncatedCount} more tracked competitors - see your Ryvl dashboard for the full list.`, MARGIN, 1.85 * IN + (ROWS_PER_TABLE_PAGE + 1) * 0.34 * IN + 6);
  }
  footer(doc, sourceLine(snapshot), snapshot.metadata.mode);
}

function renderSkuPerformance(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, label: string) {
  const pp = snapshot.productPerformance;
  if (!pp || !section.rowRange) return;
  const basisLabel = pp.contributionBasis === 'revenue' ? 'by revenue' : 'by inventory value';
  header(doc, section.title, `Top products ${basisLabel}`, label);
  const rows = pp.topProducts.slice(section.rowRange[0], section.rowRange[1]);
  table(
    doc,
    ['Product', 'SKU', pp.contributionBasis === 'revenue' ? 'Revenue Share' : 'Inventory Value Share'],
    rows.map((r) => [r.title, r.sku ?? '-', r.contributionShare != null ? formatPercent(r.contributionShare * 100, 1) : 'N/A']),
    MARGIN,
    1.85 * IN,
    CONTENT_W,
  );
  if (section.truncated) {
    doc.fillColor(hex(COLORS.gray)).font('Helvetica-Oblique').fontSize(10).text(`+${section.truncatedCount} more products - see your Ryvl dashboard for the full list.`, MARGIN, 1.85 * IN + (ROWS_PER_TABLE_PAGE + 1) * 0.34 * IN + 6);
  }
  footer(doc, sourceLine(snapshot), snapshot.metadata.mode);
}

function renderInventoryRisk(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, label: string) {
  const ir = snapshot.inventoryRisk;
  if (!ir) return;
  header(doc, 'Inventory & Demand Risk', `${ir.lowStockSkuCount} SKUs below your low-stock threshold`, label);
  table(doc, ['Product', 'SKU'], ir.stockoutRiskSkus.map((s) => [s.title, s.sku ?? '-']), MARGIN, 1.85 * IN, CONTENT_W * 0.55);
  if (ir.supplyVoidOpportunities && ir.supplyVoidOpportunities.length > 0) {
    const x = MARGIN + CONTENT_W * 0.6;
    doc.fillColor(hex(COLORS.gray)).font('Helvetica-Bold').fontSize(10).text('SUPPLY VOID OPPORTUNITIES', x, 1.85 * IN);
    ir.supplyVoidOpportunities.slice(0, 4).forEach((op, i) => {
      doc.fillColor(hex(COLORS.ink)).font('Helvetica').fontSize(10).text(`${op.competitorName} (${op.platformName}) is out of stock`, x, 2.25 * IN + i * 28);
    });
  }
  footer(doc, sourceLine(snapshot), snapshot.metadata.mode);
}

function renderPortfolio(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, label: string) {
  const pp = snapshot.productPerformance;
  if (!pp) return;
  const basisLabel = pp.contributionBasis === 'revenue' ? 'by revenue' : 'by inventory value (no per-sale line items tracked yet)';
  header(doc, 'Product Portfolio Contribution', `Category share ${basisLabel}`, label);
  barChart(doc, pp.categoryBreakdown.map((c) => c.category), pp.categoryBreakdown.map((c) => Math.round(c.share * 1000) / 10), MARGIN, 1.85 * IN, CONTENT_W, 4.3 * IN);
  footer(doc, sourceLine(snapshot), snapshot.metadata.mode);
}

function renderCustomerHealth(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, label: string) {
  const ch = snapshot.customerHealth;
  if (!ch) return;
  header(doc, 'Customer Health & Retention', 'Based on your own order and customer history', label);
  const cards: KpiSpec[] = [];
  if (ch.retentionRate) cards.push({ label: 'Retention Rate', value: formatPercent(ch.retentionRate.current, 1) });
  if (ch.repeatPurchaseRate != null) cards.push({ label: 'Repeat Purchase Rate', value: formatPercent(ch.repeatPurchaseRate, 1) });
  if (ch.avgClv) cards.push({ label: 'Avg. Customer LTV', value: formatCurrency(ch.avgClv.value, snapshot.workspace.reportingCurrency) });
  kpiRow(doc, cards, 1.85 * IN);
  if (ch.atRiskCohorts.length > 0) {
    let y = 3.25 * IN;
    doc.fillColor(hex(COLORS.gray)).font('Helvetica-Bold').fontSize(10).text('AT-RISK COHORTS', MARGIN, y);
    y += 0.35 * IN;
    ch.atRiskCohorts.forEach((c) => {
      doc.roundedRect(MARGIN, y, CONTENT_W, 0.75 * IN, 6).fillAndStroke(hex(COLORS.lavenderTint), hex(COLORS.lavender));
      doc.fillColor(hex(COLORS.ink)).font('Helvetica').fontSize(11).text(`${c.label}: ${c.count} customers`, MARGIN + 12, y + 26);
      y += 0.9 * IN;
    });
  }
  footer(doc, sourceLine(snapshot), snapshot.metadata.mode);
}

function renderRecommendations(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, label: string) {
  header(doc, 'Prioritised Recommendations', 'Ranked by potential impact', label);
  const recs = snapshot.recommendations.slice(0, 6);
  const cardH = 0.85 * IN;
  const gap = 0.14 * IN;
  recs.forEach((r, i) => {
    const y = 1.9 * IN + i * (cardH + gap);
    const priorityColor = r.priority === 'high' ? COLORS.red : r.priority === 'medium' ? COLORS.amber : COLORS.gray;
    doc.rect(MARGIN, y, 5, cardH).fill(hex(priorityColor));
    doc.rect(MARGIN + 5, y, CONTENT_W - 5, cardH).fill(hex(COLORS.offWhite));
    doc.fillColor(hex(priorityColor)).font('Helvetica-Bold').fontSize(8).text(r.priority.toUpperCase(), MARGIN + 18, y + 10);
    doc.fillColor(hex(COLORS.ink)).font('Helvetica').fontSize(11).text(r.text, MARGIN + 18, y + 26, { width: CONTENT_W - 36 });
  });
  footer(doc, sourceLine(snapshot), snapshot.metadata.mode);
}

function renderRoadmap(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, label: string) {
  const roadmap = snapshot.strategicRoadmap;
  if (!roadmap) return;
  header(doc, 'Strategic Action Roadmap', "Sequenced from this report's findings", label);
  const colW = (CONTENT_W - (roadmap.length - 1) * 0.2 * IN) / roadmap.length;
  roadmap.forEach((phase, i) => {
    const x = MARGIN + i * (colW + 0.2 * IN);
    doc.fillColor(hex(COLORS.indigo)).font('Helvetica-Bold').fontSize(9).text(`PHASE ${String(phase.phase).padStart(2, '0')}`, x, 1.9 * IN, { width: colW });
    doc.fillColor(hex(COLORS.navy)).font('Helvetica-Bold').fontSize(14).text(phase.title, x, 2.2 * IN, { width: colW });
    doc.fillColor(hex(COLORS.ink)).font('Helvetica').fontSize(10).text(phase.description, x, 2.75 * IN, { width: colW });
  });
  footer(doc, sourceLine(snapshot), snapshot.metadata.mode);
}

function renderMethodology(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, label: string) {
  header(doc, 'Methodology, Privacy & Data Sources', 'How this report was built', label);
  const m = snapshot.methodology;
  let y = 1.9 * IN;
  doc.fillColor(hex(COLORS.gray)).font('Helvetica-Bold').fontSize(10).text('DATA SOURCES', MARGIN, y);
  y += 24;
  for (const source of m.dataSources) {
    doc.fillColor(hex(COLORS.ink)).font('Helvetica').fontSize(10.5).text(`${source.name}: ${source.description}`, MARGIN, y, { width: CONTENT_W });
    y += 26;
  }
  y += 14;
  doc.fillColor(hex(COLORS.gray)).font('Helvetica-Bold').fontSize(10).text('LIMITATIONS', MARGIN, y);
  y += 24;
  for (const limitation of m.limitations) {
    doc.fillColor(hex(COLORS.ink)).font('Helvetica').fontSize(10.5).text(`•  ${limitation}`, MARGIN, y, { width: CONTENT_W });
    y += 30;
  }
  doc
    .fillColor(hex(COLORS.gray))
    .font('Helvetica')
    .fontSize(9)
    .text(`Report status: ${snapshot.privacy.approval.status}${snapshot.privacy.approval.reviewedBy ? ` · Reviewed by ${snapshot.privacy.approval.reviewedBy}` : ''}`, MARGIN, H - 0.9 * IN);
  footer(doc, sourceLine(snapshot), snapshot.metadata.mode);
}

function renderAppendix(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, label: string) {
  header(doc, 'Appendix', 'Internal notes - not included in client-safe exports', label);
  const entries = Object.entries(snapshot.appendix ?? {}).filter(([key]) => key !== 'aiSummary');
  let y = 1.9 * IN;
  for (const [key, value] of entries) {
    doc.fillColor(hex(COLORS.gray)).font('Helvetica').fontSize(9).text(`${key}: ${JSON.stringify(value)}`, MARGIN, y, { width: CONTENT_W });
    y += 20;
  }
  footer(doc, sourceLine(snapshot), snapshot.metadata.mode);
}
