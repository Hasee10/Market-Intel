'server-only';

import PDFDocument from 'pdfkit';
import type { ReportSnapshot } from '../../schema';
import { buildSectionPlan, type PlannedSection, type SectionPlan, ROWS_PER_TABLE_PAGE } from '../../section-plan';
import { COLORS, formatCurrency, formatDate, formatPercent } from '../../design-tokens';

// Mirrors render/pptx/build-deck.ts section-for-section against the same
// ReportSnapshot and the same section plan, so both formats come from one
// structured source without needing to share rendering code. Native vector
// PDF throughout - pdfkit draws every bar and rule directly, nothing is
// rasterized.
const IN = 72;
const W = 20 * IN;
const H = 11.25 * IN;
const MARGIN = 0.875 * IN;
const CONTENT_W = W - MARGIN * 2;
const CONTENT_TOP = 2.55 * IN;
const FOOTER_RULE_Y = 10.375 * IN;
const CARD_RADIUS = 14;

const hex = (c: string) => `#${c}`;

// pdfkit ships Helvetica; Inter is not embedded, so the PDF uses the closest
// available grotesque. Swapping in a real Inter TTF is a font-licensing/
// asset decision, not a code one - noted rather than silently faked.
const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';

export async function buildReportPdf(snapshot: ReportSnapshot): Promise<Buffer> {
  const plan = buildSectionPlan(snapshot);
  const doc = new PDFDocument({ size: [W, H], margin: 0, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  let slideIndex = 0;
  const label = () => {
    slideIndex += 1;
    return String(slideIndex).padStart(2, '0');
  };

  plan.sections.forEach((section, i) => {
    if (i > 0) doc.addPage({ size: [W, H], margin: 0 });
    switch (section.kind) {
      case 'cover':
        slideIndex += 1;
        renderCover(doc, snapshot);
        break;
      case 'toc':
        renderToc(doc, snapshot, plan, label());
        break;
      case 'section_divider':
        slideIndex += 1;
        renderDivider(doc, section, snapshot);
        break;
      case 'executive_snapshot':
        renderExecutiveSnapshot(doc, snapshot, label());
        break;
      case 'market_position':
        renderMarketPosition(doc, snapshot, label());
        break;
      case 'pricing_intelligence':
        renderPricingIntelligence(doc, snapshot, label());
        break;
      case 'competitor_tracking':
        renderCompetitorTracking(doc, snapshot, section, label());
        break;
      case 'sku_performance':
        renderSkuPerformance(doc, snapshot, section, label());
        break;
      case 'inventory_risk':
        renderInventoryRisk(doc, snapshot, label());
        break;
      case 'portfolio_contribution':
        renderPortfolio(doc, snapshot, label());
        break;
      case 'customer_health':
        renderCustomerHealth(doc, snapshot, label());
        break;
      case 'recommendations':
        renderRecommendations(doc, snapshot, label());
        break;
      case 'roadmap':
        renderRoadmap(doc, snapshot, label());
        break;
      case 'methodology':
        renderMethodology(doc, snapshot, label());
        break;
      case 'appendix':
        renderAppendix(doc, snapshot, label());
        break;
    }
  });

  doc.end();
  return done;
}

// -- Shared primitives ----------------------------------------------------

function canvas(doc: PDFKit.PDFDocument, color: string = COLORS.canvas) {
  doc.rect(0, 0, W, H).fill(hex(color));
}

function card(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, fill: string = COLORS.paper) {
  doc.roundedRect(x, y, w, h, CARD_RADIUS).fill(hex(fill));
}

function header(doc: PDFKit.PDFDocument, title: string, subtitle: string, pageLabel: string) {
  doc.rect(0, 0, W, 2.175 * IN).fill(hex(COLORS.paper));
  doc.fillColor(hex(COLORS.brand)).font(FONT_BOLD).fontSize(16).text('Ryvl', MARGIN, 0.458 * IN, { lineBreak: false });
  doc
    .fillColor(hex(COLORS.grayLight))
    .font(FONT_BOLD)
    .fontSize(12.75)
    .text(pageLabel, W - MARGIN - 150, 0.475 * IN, { width: 150, align: 'right', lineBreak: false });
  doc.fillColor(hex(COLORS.ink)).font(FONT_BOLD).fontSize(36).text(title, MARGIN, 0.917 * IN, { width: CONTENT_W });
  if (subtitle) {
    doc.fillColor(hex(COLORS.gray)).font(FONT).fontSize(16.5).text(subtitle, MARGIN, 1.579 * IN, { width: CONTENT_W });
  }
  doc.rect(0, 2.175 * IN, W, 1).fill(hex(COLORS.hairline));
}

function footer(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot) {
  doc.rect(0, FOOTER_RULE_Y, W, H - FOOTER_RULE_Y).fill(hex(COLORS.paper));
  doc.rect(0, FOOTER_RULE_Y, W, 1).fill(hex(COLORS.hairline));
  doc
    .fillColor(hex(COLORS.gray))
    .font(FONT_ITALIC)
    .fontSize(12.75)
    .text(sourceLine(snapshot), MARGIN, 10.708 * IN, { width: CONTENT_W - 260, lineBreak: false });
  confidentialityPill(doc, snapshot, W - MARGIN - 240, 10.633 * IN);
}

function confidentialityPill(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, x: number, y: number) {
  const internal = snapshot.metadata.mode === 'internal';
  const label = internal ? 'Internal - not for distribution' : 'Confidential';
  const w = internal ? 240 : 140;
  doc.roundedRect(x + (internal ? 0 : 100), y, w, 0.367 * IN, 12).fill(hex(internal ? COLORS.negativeBg : COLORS.panelBg));
  doc
    .fillColor(hex(internal ? COLORS.negative : COLORS.brand))
    .font(FONT_BOLD)
    .fontSize(12)
    .text(label, x + (internal ? 0 : 100), y + 8, { width: w, align: 'center', lineBreak: false });
}

function sourceLine(snapshot: ReportSnapshot): string {
  return `Source: ${snapshot.methodology.dataSources.map((s) => s.name).join(' - ')}  ·  Generated ${formatDate(snapshot.metadata.generatedAt)}`;
}

function eyebrow(doc: PDFKit.PDFDocument, text: string, x: number, y: number, w: number, color: string = COLORS.gray) {
  doc.fillColor(hex(color)).font(FONT_BOLD).fontSize(12).text(text.toUpperCase(), x, y, { width: w, characterSpacing: 1.2 });
}

function cardHeading(doc: PDFKit.PDFDocument, text: string, x: number, y: number, w: number) {
  doc.fillColor(hex(COLORS.ink)).font(FONT_BOLD).fontSize(19.5).text(text, x, y, { width: w });
}

interface KpiSpec {
  label: string;
  value: string;
  delta?: string | null;
  deltaColor?: string;
  onDark?: boolean;
}

function kpiRow(doc: PDFKit.PDFDocument, cards: KpiSpec[], x: number, y: number, w: number, h = 1.96 * IN) {
  if (cards.length === 0) return;
  const gap = 0.29 * IN;
  const cardW = (w - gap * (cards.length - 1)) / cards.length;
  cards.forEach((c, i) => {
    const cx = x + i * (cardW + gap);
    const pad = c.onDark ? 0 : 0.33 * IN;
    if (!c.onDark) doc.roundedRect(cx, y, cardW, h, CARD_RADIUS).fill(hex(COLORS.paper));
    doc
      .fillColor(hex(c.onDark ? COLORS.paper : COLORS.gray))
      .font(FONT_BOLD)
      .fontSize(12)
      .text(c.label.toUpperCase(), cx + pad, y + (c.onDark ? 0 : 0.29 * IN), { width: cardW - pad * 2, characterSpacing: 1.2 });
    doc
      .fillColor(hex(c.onDark ? COLORS.paper : COLORS.ink))
      .font(FONT_BOLD)
      .fontSize(c.onDark ? 27 : 33)
      .text(c.value, cx + pad, y + (c.onDark ? 0.3 * IN : 0.62 * IN), { width: cardW - pad * 2, lineBreak: false });
    if (c.delta) {
      doc
        .fillColor(hex(c.deltaColor ?? COLORS.grayLight))
        .font(FONT_BOLD)
        .fontSize(15)
        .text(c.delta, cx + pad, y + h - (c.onDark ? 0.35 * IN : 0.62 * IN), { width: cardW - pad * 2, lineBreak: false });
    }
  });
}

function growthKpi(label: string, m: ReportSnapshot['revenue'] extends null ? never : any, fmt: (v: number) => string, onDark = false): KpiSpec {
  return {
    label,
    value: fmt(m.current),
    delta: m.changePct != null ? `${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(1)}% vs. prior period` : 'No prior-period baseline',
    deltaColor:
      m.direction === 'up' ? (onDark ? COLORS.positiveOnDark : COLORS.positive) : m.direction === 'down' ? COLORS.negative : COLORS.grayLight,
    onDark,
  };
}

function pill(doc: PDFKit.PDFDocument, text: string, bg: string, fg: string, x: number, y: number, w: number) {
  const h = 0.296 * IN;
  doc.roundedRect(x, y, w, h, h / 2).fill(hex(bg));
  doc.fillColor(hex(fg)).font(FONT_BOLD).fontSize(12).text(text, x, y + 6, { width: w, align: 'center', lineBreak: false });
}

interface BarRow {
  title: string;
  subtitle?: string | null;
  valueText: string;
  ratio: number;
  color?: string;
}

function barRows(doc: PDFKit.PDFDocument, rows: BarRow[], x: number, y: number, w: number, pitch: number) {
  const trackW = w * 0.62;
  const trackH = 0.146 * IN;
  rows.forEach((row, i) => {
    const rowY = y + i * pitch;
    doc.fillColor(hex(COLORS.ink)).font(FONT_BOLD).fontSize(16.5).text(row.title, x, rowY, { width: w - 160, lineBreak: false });
    if (row.subtitle) {
      doc.fillColor(hex(COLORS.grayLight)).font(FONT).fontSize(13.5).text(row.subtitle, x, rowY + 22, { width: w - 160, lineBreak: false });
    }
    const barY = rowY + (row.subtitle ? 48 : 30);
    doc.roundedRect(x, barY, trackW, trackH, trackH / 2).fill(hex(COLORS.canvas));
    const fillW = Math.max(trackW * Math.min(Math.max(row.ratio, 0), 1), 3);
    doc
      .roundedRect(x, barY, fillW, trackH, trackH / 2)
      .fill(hex(row.color ?? COLORS.rankRamp[Math.min(i, COLORS.rankRamp.length - 1)]));
    doc
      .fillColor(hex(COLORS.ink))
      .font(FONT_BOLD)
      .fontSize(16.5)
      .text(row.valueText, x + w - 150, rowY + 4, { width: 150, align: 'right', lineBreak: false });
    if (i < rows.length - 1) doc.rect(x, rowY + pitch - 12, w, 1).fill(hex(COLORS.hairlineSoft));
  });
}

function dataRows(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: (string | number)[][],
  colWidths: number[],
  x: number,
  y: number,
  w: number,
  pitch: number,
) {
  let cx = x;
  headers.forEach((hd, i) => {
    doc
      .fillColor(hex(COLORS.grayLight))
      .font(FONT_BOLD)
      .fontSize(12)
      .text(hd.toUpperCase(), cx, y, { width: colWidths[i], align: i === 0 ? 'left' : 'right', characterSpacing: 1.1 });
    cx += colWidths[i];
  });
  doc.rect(x, y + 30, w, 1).fill(hex(COLORS.hairline));

  rows.forEach((row, r) => {
    const rowY = y + 45 + r * pitch;
    let colX = x;
    row.forEach((cell, c) => {
      doc
        .fillColor(hex(c === 0 ? COLORS.ink : COLORS.gray))
        .font(c === 0 ? FONT_BOLD : FONT)
        .fontSize(16.5)
        .text(String(cell), colX, rowY, { width: colWidths[c], align: c === 0 ? 'left' : 'right', lineBreak: false });
      colX += colWidths[c];
    });
    if (r < rows.length - 1) doc.rect(x, rowY + pitch - 14, w, 1).fill(hex(COLORS.hairlineSoft));
  });
}

function insightPanel(doc: PDFKit.PDFDocument, eyebrowText: string, body: string, x: number, y: number, w: number, h: number) {
  doc.roundedRect(x, y, w, h, CARD_RADIUS).fill(hex(COLORS.panelBg));
  eyebrow(doc, eyebrowText, x + 30, y + 22, w - 60, COLORS.brandAccent);
  doc.fillColor(hex(COLORS.ink)).font(FONT).fontSize(16.5).text(body, x + 30, y + 50, { width: w - 60, height: h - 70 });
}

// -- Section renderers ----------------------------------------------------

function renderCover(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot) {
  canvas(doc);
  const panelW = 14.042 * IN;
  doc.rect(0, 0, panelW, H).fill(hex(COLORS.brand));

  doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(18).text('Ryvl', MARGIN, 0.667 * IN);
  doc
    .fillColor(hex(COLORS.paper))
    .font(FONT_BOLD)
    .fontSize(12)
    .text('SELLER MARKET INTELLIGENCE  ·  PERIODIC BRIEFING', MARGIN, 2.6 * IN, { width: panelW - MARGIN * 2, characterSpacing: 2 });
  doc
    .fillColor(hex(COLORS.paper))
    .font(FONT_BOLD)
    .fontSize(64.5)
    .text(snapshot.workspace.businessName, MARGIN, 3.2 * IN, { width: panelW - MARGIN * 2 });
  const subtitle =
    snapshot.workspace.categories.length > 0
      ? `Market intelligence for ${snapshot.workspace.categories.map((c) => c.name).join(', ')}`
      : 'Seller market intelligence report';
  doc.fillColor(hex(COLORS.paper)).font(FONT).fontSize(23.25).text(subtitle, MARGIN, 5.15 * IN, { width: panelW - MARGIN * 2 });
  doc
    .fillColor(hex(COLORS.paper))
    .font(FONT)
    .fontSize(14)
    .text(
      `${snapshot.metadata.period.label}   ·   Generated ${formatDate(snapshot.metadata.generatedAt)}   ·   Ref: ${snapshot.metadata.reportId.slice(0, 8).toUpperCase()}`,
      MARGIN,
      6.1 * IN,
      { width: panelW - MARGIN * 2 },
    );

  const cards: KpiSpec[] = [];
  const currency = snapshot.workspace.reportingCurrency;
  if (snapshot.revenue) {
    cards.push(growthKpi('Revenue', snapshot.revenue.revenue, (v) => formatCurrency(v, currency), true));
    cards.push(growthKpi('Orders', snapshot.revenue.orders, (v) => String(Math.round(v)), true));
  }
  if (snapshot.competitorBenchmarks) {
    cards.push({ label: 'Competitors tracked', value: String(snapshot.competitorBenchmarks.scorecards.length), onDark: true });
  }
  if (cards.length > 0) {
    doc.rect(MARGIN, 8.5 * IN, panelW - MARGIN * 2, 1).fill(hex(COLORS.paper));
    kpiRow(doc, cards, MARGIN, 8.9 * IN, panelW - MARGIN * 2, 1.3 * IN);
  }

  eyebrow(doc, 'Prepared for', panelW + 54, 3.2 * IN, W - panelW - 108, COLORS.grayLight);
  doc.fillColor(hex(COLORS.ink)).font(FONT_BOLD).fontSize(22).text(snapshot.workspace.businessName, panelW + 54, 3.55 * IN, { width: W - panelW - 108 });
  eyebrow(doc, 'Reporting period', panelW + 54, 4.7 * IN, W - panelW - 108, COLORS.grayLight);
  doc.fillColor(hex(COLORS.ink)).font(FONT).fontSize(18).text(snapshot.metadata.period.label, panelW + 54, 5.05 * IN, { width: W - panelW - 108 });

  confidentialityPill(doc, snapshot, W - MARGIN - 240, 10.5 * IN);
}

function renderToc(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, plan: SectionPlan, pageLabel: string) {
  canvas(doc);
  header(
    doc,
    "What's in this report",
    `${plan.includedSectionCount} of ${plan.candidateSectionCount} sections have enough tracked data this cycle`,
    pageLabel,
  );

  const colGap = 0.58 * IN;
  const colW = (CONTENT_W - colGap) / 2;
  const pitch = 0.663 * IN;
  const perColumn = Math.ceil(plan.toc.length / 2);
  const cardH = perColumn * pitch + 0.75 * IN;

  [0, 1].forEach((col) => {
    const entries = plan.toc.slice(col * perColumn, (col + 1) * perColumn);
    if (entries.length === 0) return;
    const x = MARGIN + col * (colW + colGap);
    card(doc, x, CONTENT_TOP, colW, cardH);
    entries.forEach((entry, i) => {
      const y = CONTENT_TOP + 0.46 * IN + i * pitch;
      const included = entry.status === 'included';
      doc
        .fillColor(hex(included ? COLORS.grayLight : COLORS.grayLightest))
        .font(FONT_BOLD)
        .fontSize(13.5)
        .text(entry.number != null ? String(entry.number).padStart(2, '0') : '—', x + 30, y, { width: 40, lineBreak: false });
      doc
        .fillColor(hex(included ? COLORS.ink : COLORS.grayLight))
        .font(included ? FONT_BOLD : FONT)
        .fontSize(18)
        .text(entry.title, x + 82, y - 2, { width: colW - 250, lineBreak: false });
      const pillText = entry.status === 'included' ? 'Included' : entry.status === 'omitted' ? 'Omitted' : 'Not enough data';
      pill(
        doc,
        pillText,
        included ? COLORS.positiveBg : COLORS.canvas,
        included ? COLORS.positive : COLORS.grayLight,
        x + colW - 150,
        y,
        120,
      );
      if (i < entries.length - 1) doc.rect(x + 30, y + pitch - 12, colW - 60, 1).fill(hex(COLORS.hairlineSoft));
    });
  });

  insightPanel(
    doc,
    'How this report is built',
    'Sections appear only when the underlying data supports them. Anything marked "not enough data" was considered and left out rather than shown with a misleading zero - the methodology page lists every source and limitation behind the numbers here.',
    MARGIN,
    CONTENT_TOP + cardH + 0.4 * IN,
    CONTENT_W,
    1.5 * IN,
  );

  footer(doc, snapshot);
}

function renderDivider(doc: PDFKit.PDFDocument, section: PlannedSection, snapshot: ReportSnapshot) {
  canvas(doc, COLORS.brand);
  const num = String(section.chapterNumber ?? 1).padStart(2, '0');

  doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(16).text('Ryvl', MARGIN, 0.667 * IN);
  doc
    .fillColor(hex(COLORS.paper))
    .font(FONT_BOLD)
    .fontSize(12)
    .text(`Section ${num} of ${String(section.chapterTotal ?? 1).padStart(2, '0')}`, W - MARGIN - 220, 0.735 * IN, {
      width: 220,
      align: 'right',
      lineBreak: false,
    });

  doc.save().opacity(0.12);
  doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(240).text(num, W - 6.5 * IN, 2.2 * IN, { width: 6 * IN, align: 'right', lineBreak: false });
  doc.restore();

  doc.save().opacity(0.7);
  doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(12).text(`SECTION ${num}`, MARGIN, 4.1 * IN, { characterSpacing: 2 });
  doc.restore();
  doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(58).text(section.title, MARGIN, 4.5 * IN, { width: CONTENT_W * 0.72 });
  if (section.dividerSubtitle) {
    doc.save().opacity(0.78);
    doc.fillColor(hex(COLORS.paper)).font(FONT).fontSize(20).text(section.dividerSubtitle, MARGIN, 6.1 * IN, { width: CONTENT_W * 0.62 });
    doc.restore();
  }

  const stats = section.dividerStats ?? [];
  if (stats.length > 0) {
    const stripY = 8.2 * IN;
    doc.rect(MARGIN, stripY, CONTENT_W, 1).fill(hex(COLORS.paper));
    const colW = CONTENT_W / stats.length;
    stats.forEach((stat, i) => {
      const sx = MARGIN + i * colW;
      doc.save().opacity(0.65);
      doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(12).text(stat.label.toUpperCase(), sx, stripY + 30, { width: colW - 30, characterSpacing: 1.2 });
      doc.restore();
      doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(30).text(stat.value, sx, stripY + 54, { width: colW - 30, lineBreak: false });
    });
  }

  confidentialityPill(doc, snapshot, W - MARGIN - 240, 10.5 * IN);
}

function renderExecutiveSnapshot(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  canvas(doc);
  header(doc, 'Executive Snapshot & Key Signals', `${snapshot.workspace.businessName} · ${snapshot.metadata.period.label}`, pageLabel);

  const currency = snapshot.workspace.reportingCurrency;
  const cards: KpiSpec[] = [];
  if (snapshot.revenue) {
    cards.push(growthKpi('Revenue', snapshot.revenue.revenue, (v) => formatCurrency(v, currency)));
    cards.push(growthKpi('Orders', snapshot.revenue.orders, (v) => String(Math.round(v))));
  }
  if (snapshot.marketplacePerformance?.priceIndex) {
    cards.push({ label: 'Price index', value: snapshot.marketplacePerformance.priceIndex.value.toFixed(0), delta: '100 = at market median' });
  }
  if (snapshot.inventoryRisk) {
    cards.push({ label: 'Stockout risk SKUs', value: String(snapshot.inventoryRisk.lowStockSkuCount), delta: 'Below low-stock threshold' });
  }
  kpiRow(doc, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  const lowerY = CONTENT_TOP + 2.25 * IN;
  const lowerH = FOOTER_RULE_Y - lowerY - 0.4 * IN;
  const narrative = snapshot.appendix?.aiSummary as string | undefined;
  const signals = snapshot.marketSignals.slice(0, 4);

  if (signals.length > 0) {
    const signalsW = narrative ? CONTENT_W * 0.58 : CONTENT_W;
    card(doc, MARGIN, lowerY, signalsW, lowerH);
    cardHeading(doc, 'What changed this cycle', MARGIN + 30, lowerY + 26, signalsW - 60);
    signals.forEach((signal, i) => {
      const sy = lowerY + 72 + i * 66;
      doc.rect(MARGIN + 30, sy + 8, 4, 38).fill(hex(COLORS.brandAccent));
      doc.fillColor(hex(COLORS.ink)).font(FONT).fontSize(16.5).text(signal.description, MARGIN + 54, sy, { width: signalsW - 100 });
    });
  }

  if (narrative) {
    const panelX = signals.length > 0 ? MARGIN + CONTENT_W * 0.58 + 30 : MARGIN;
    const panelW = signals.length > 0 ? CONTENT_W * 0.42 - 30 : CONTENT_W;
    insightPanel(doc, 'Read', narrative, panelX, lowerY, panelW, lowerH);
  }

  footer(doc, snapshot);
}

function renderMarketPosition(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  const mp = snapshot.marketplacePerformance;
  if (!mp) return;
  canvas(doc);
  header(doc, 'Market Position & Benchmark Percentiles', `Tracked across ${mp.scope.platformNames.join(', ') || 'tracked marketplaces'}`, pageLabel);

  const cards: KpiSpec[] = [];
  if (mp.priceIndex) cards.push({ label: 'Price index vs. market', value: mp.priceIndex.value.toFixed(0), delta: '100 = at market median' });
  if (snapshot.pricePositioning?.percentile != null) {
    cards.push({ label: 'Your percentile', value: `${snapshot.pricePositioning.percentile}th`, delta: 'Of the tracked price range' });
  }
  cards.push({ label: 'Platforms in scope', value: String(mp.scope.platformNames.length) });
  kpiRow(doc, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  const chartY = CONTENT_TOP + 2.25 * IN;
  const chartH = FOOTER_RULE_Y - chartY - 0.4 * IN;
  card(doc, MARGIN, chartY, CONTENT_W, chartH);
  cardHeading(doc, 'Where your price sits in the tracked market', MARGIN + 30, chartY + 26, CONTENT_W - 60);

  if (snapshot.pricePositioning?.percentile != null) {
    barRows(
      doc,
      [
        { title: '25th percentile', valueText: '25', ratio: 0.25, color: COLORS.grayLight },
        { title: 'Your position', valueText: `${snapshot.pricePositioning.percentile}`, ratio: snapshot.pricePositioning.percentile / 100, color: COLORS.brandAccent },
        { title: '75th percentile', valueText: '75', ratio: 0.75, color: COLORS.grayLight },
      ],
      MARGIN + 30,
      chartY + 76,
      CONTENT_W - 60,
      86,
    );
  }

  footer(doc, snapshot);
}

function renderPricingIntelligence(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  const pp = snapshot.pricePositioning;
  if (!pp) return;
  canvas(doc);
  header(doc, 'Pricing Intelligence', 'Your price against the tracked market median', pageLabel);

  const currency = snapshot.workspace.reportingCurrency;
  const cards: KpiSpec[] = [
    { label: 'Your price', value: formatCurrency(pp.yourMedianPrice.value, currency) },
    { label: 'Market median', value: formatCurrency(pp.marketMedian.value, currency) },
  ];
  if (pp.recommendedBand) {
    cards.push({
      label: 'Supported band',
      value: `${formatCurrency(pp.recommendedBand.low, currency)} - ${formatCurrency(pp.recommendedBand.high, currency)}`,
    });
  }
  kpiRow(doc, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  const lowerY = CONTENT_TOP + 2.25 * IN;
  const lowerH = FOOTER_RULE_Y - lowerY - 0.4 * IN;
  card(doc, MARGIN, lowerY, CONTENT_W, lowerH);

  if (pp.trend && pp.trend.length >= 2) {
    cardHeading(doc, 'Market median price over time', MARGIN + 30, lowerY + 26, CONTENT_W - 60);
    lineChart(doc, pp.trend.map((t) => t.medianPrice), pp.trend.map((t) => formatDate(t.date)), MARGIN + 30, lowerY + 76, CONTENT_W - 60, lowerH - 120);
  } else {
    cardHeading(doc, 'Your price against the tracked range', MARGIN + 30, lowerY + 26, CONTENT_W - 60);
    const max = Math.max(pp.yourMedianPrice.value, pp.marketMedian.value, pp.recommendedBand?.high ?? 0) || 1;
    const rows: BarRow[] = [
      { title: 'Your price', valueText: formatCurrency(pp.yourMedianPrice.value, currency), ratio: pp.yourMedianPrice.value / max, color: COLORS.brandAccent },
      { title: 'Market median', valueText: formatCurrency(pp.marketMedian.value, currency), ratio: pp.marketMedian.value / max, color: COLORS.info },
    ];
    if (pp.recommendedBand) {
      rows.push({
        title: 'Top of supported band',
        valueText: formatCurrency(pp.recommendedBand.high, currency),
        ratio: pp.recommendedBand.high / max,
        color: COLORS.grayLight,
      });
    }
    barRows(doc, rows, MARGIN + 30, lowerY + 80, CONTENT_W - 60, 86);
  }

  footer(doc, snapshot);
}

function lineChart(doc: PDFKit.PDFDocument, values: number[], labels: string[], x: number, y: number, w: number, h: number) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const plotH = h - 30;
  const stepX = w / Math.max(values.length - 1, 1);

  for (let i = 0; i <= 4; i++) {
    const gy = y + (plotH / 4) * i;
    doc.rect(x, gy, w, 0.5).fill(hex(COLORS.hairline));
  }

  doc.save().lineWidth(3).strokeColor(hex(COLORS.brandAccent));
  values.forEach((v, i) => {
    const px = x + i * stepX;
    const py = y + plotH - ((v - min) / span) * plotH;
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  });
  doc.stroke();
  doc.restore();

  values.forEach((v, i) => {
    const px = x + i * stepX;
    const py = y + plotH - ((v - min) / span) * plotH;
    doc.circle(px, py, 5).fill(hex(COLORS.brandAccent));
  });

  labels.forEach((lab, i) => {
    if (labels.length > 8 && i % 2 !== 0) return;
    doc.fillColor(hex(COLORS.gray)).font(FONT).fontSize(11).text(lab, x + i * stepX - 40, y + plotH + 10, { width: 80, align: 'center', lineBreak: false });
  });
}

function renderCompetitorTracking(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, pageLabel: string) {
  const cb = snapshot.competitorBenchmarks;
  if (!cb || !section.rowRange) return;
  canvas(doc);
  header(doc, section.title, cb.marketDefinitionSummary, pageLabel);

  const currency = snapshot.workspace.reportingCurrency;
  const rows = cb.scorecards.slice(section.rowRange[0], section.rowRange[1]);
  const cardH = FOOTER_RULE_Y - CONTENT_TOP - 0.4 * IN;
  card(doc, MARGIN, CONTENT_TOP, CONTENT_W, cardH);

  const inner = CONTENT_W - 60;
  dataRows(
    doc,
    ['Competitor', 'Platform', 'SKUs', 'Median price', 'In stock', 'Repricing rate'],
    rows.map((r) => [
      r.competitorName,
      r.platformName,
      r.skuCount,
      formatCurrency(r.medianPrice.value, currency),
      formatPercent(r.inStockRate * 100, 0),
      r.repricingRate != null ? formatPercent(r.repricingRate * 100, 0) : 'N/A',
    ]),
    [inner * 0.28, inner * 0.16, inner * 0.12, inner * 0.16, inner * 0.13, inner * 0.15],
    MARGIN + 30,
    CONTENT_TOP + 36,
    inner,
    62,
  );

  if (section.truncated) {
    doc
      .fillColor(hex(COLORS.gray))
      .font(FONT_ITALIC)
      .fontSize(14)
      .text(`+${section.truncatedCount} more tracked competitors — the full list stays live in your Ryvl dashboard.`, MARGIN + 30, CONTENT_TOP + 80 + ROWS_PER_TABLE_PAGE * 62, { width: inner });
  }

  doc
    .fillColor(hex(COLORS.grayLight))
    .font(FONT)
    .fontSize(12)
    .text('Public marketplace signals only. Private seller data is never shown.', MARGIN + 30, CONTENT_TOP + cardH - 42, { width: inner });

  footer(doc, snapshot);
}

function renderSkuPerformance(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, section: PlannedSection, pageLabel: string) {
  const pp = snapshot.productPerformance;
  if (!pp || !section.rowRange) return;
  canvas(doc);
  const basis = pp.contributionBasis === 'revenue' ? 'revenue' : 'inventory value';
  header(doc, section.title, `Top products by ${basis} share`, pageLabel);

  const rows = pp.topProducts.slice(section.rowRange[0], section.rowRange[1]);
  const cardH = FOOTER_RULE_Y - CONTENT_TOP - 0.4 * IN;
  card(doc, MARGIN, CONTENT_TOP, CONTENT_W, cardH);
  cardHeading(doc, `Top products by ${basis} share`, MARGIN + 30, CONTENT_TOP + 26, CONTENT_W - 60);

  const maxShare = Math.max(...rows.map((r) => r.contributionShare ?? 0), 0.0001);
  barRows(
    doc,
    rows.map((r) => ({
      title: r.title,
      subtitle: r.sku,
      valueText: r.contributionShare != null ? formatPercent(r.contributionShare * 100, 1) : 'N/A',
      ratio: (r.contributionShare ?? 0) / maxShare,
    })),
    MARGIN + 30,
    CONTENT_TOP + 76,
    CONTENT_W - 60,
    90,
  );

  if (section.truncated) {
    doc
      .fillColor(hex(COLORS.gray))
      .font(FONT_ITALIC)
      .fontSize(14)
      .text(`+${section.truncatedCount} more products — see your Ryvl dashboard for the full catalogue.`, MARGIN + 30, CONTENT_TOP + cardH - 42, { width: CONTENT_W - 60 });
  }

  footer(doc, snapshot);
}

function renderInventoryRisk(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  const ir = snapshot.inventoryRisk;
  if (!ir) return;
  canvas(doc);
  header(doc, 'Inventory & Demand Risk', `${ir.lowStockSkuCount} SKUs below your low-stock threshold`, pageLabel);

  const hasVoids = (ir.supplyVoidOpportunities?.length ?? 0) > 0;
  const cardH = FOOTER_RULE_Y - CONTENT_TOP - 0.4 * IN;
  const leftW = hasVoids ? CONTENT_W * 0.55 : CONTENT_W;

  card(doc, MARGIN, CONTENT_TOP, leftW, cardH);
  cardHeading(doc, 'At risk of stocking out', MARGIN + 30, CONTENT_TOP + 26, leftW - 60);
  eyebrow(doc, `${ir.lowStockSkuCount} flagged · ${Math.min(ir.stockoutRiskSkus.length, ir.lowStockSkuCount)} shown`, MARGIN + 30, CONTENT_TOP + 58, leftW - 60);
  ir.stockoutRiskSkus.forEach((sku, i) => {
    const y = CONTENT_TOP + 100 + i * 64;
    doc.fillColor(hex(COLORS.ink)).font(FONT_BOLD).fontSize(16.5).text(sku.title, MARGIN + 30, y, { width: leftW - 200, lineBreak: false });
    if (sku.sku) doc.fillColor(hex(COLORS.grayLight)).font(FONT).fontSize(13.5).text(sku.sku, MARGIN + 30, y + 22, { width: leftW - 200, lineBreak: false });
    pill(doc, 'Below threshold', COLORS.warningBg, COLORS.warning, MARGIN + leftW - 150, y + 4, 120);
    if (i < ir.stockoutRiskSkus.length - 1) doc.rect(MARGIN + 30, y + 52, leftW - 60, 1).fill(hex(COLORS.hairlineSoft));
  });

  if (hasVoids) {
    const rx = MARGIN + leftW + 30;
    const rw = CONTENT_W - leftW - 30;
    card(doc, rx, CONTENT_TOP, rw, cardH);
    cardHeading(doc, 'Demand you can absorb', rx + 30, CONTENT_TOP + 26, rw - 60);
    eyebrow(doc, 'Tracked competitors currently out of stock', rx + 30, CONTENT_TOP + 58, rw - 60);
    ir.supplyVoidOpportunities!.slice(0, 5).forEach((op, i) => {
      const y = CONTENT_TOP + 100 + i * 56;
      doc.fillColor(hex(COLORS.ink)).font(FONT_BOLD).fontSize(16.5).text(op.competitorName, rx + 30, y, { width: rw - 190, lineBreak: false });
      doc.fillColor(hex(COLORS.grayLight)).font(FONT).fontSize(13.5).text(op.platformName, rx + 30, y + 22, { width: rw - 190, lineBreak: false });
      pill(doc, 'Out of stock', COLORS.positiveBg, COLORS.positive, rx + rw - 140, y + 4, 110);
    });
  }

  footer(doc, snapshot);
}

function renderPortfolio(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  const pp = snapshot.productPerformance;
  if (!pp) return;
  canvas(doc);
  const basis = pp.contributionBasis === 'revenue' ? 'by revenue' : 'by inventory value (per-sale line items are not tracked yet)';
  header(doc, 'Product Portfolio Contribution', `Category mix ${basis}`, pageLabel);

  const cardH = FOOTER_RULE_Y - CONTENT_TOP - 0.4 * IN;
  card(doc, MARGIN, CONTENT_TOP, CONTENT_W, cardH);
  cardHeading(doc, 'Category share', MARGIN + 30, CONTENT_TOP + 26, CONTENT_W - 60);

  const maxShare = Math.max(...pp.categoryBreakdown.map((c) => c.share), 0.0001);
  barRows(
    doc,
    pp.categoryBreakdown.slice(0, 6).map((c) => ({ title: c.category, valueText: formatPercent(c.share * 100, 1), ratio: c.share / maxShare })),
    MARGIN + 30,
    CONTENT_TOP + 76,
    CONTENT_W - 60,
    76,
  );

  footer(doc, snapshot);
}

function renderCustomerHealth(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  const ch = snapshot.customerHealth;
  if (!ch) return;
  canvas(doc);
  header(doc, 'Customer Health & Retention', 'From your own order and customer history', pageLabel);

  const cards: KpiSpec[] = [];
  if (ch.retentionRate) cards.push({ label: 'Retention rate', value: formatPercent(ch.retentionRate.current, 1) });
  if (ch.repeatPurchaseRate != null) cards.push({ label: 'Repeat purchase rate', value: formatPercent(ch.repeatPurchaseRate, 1) });
  if (ch.avgClv) cards.push({ label: 'Avg. customer LTV', value: formatCurrency(ch.avgClv.value, snapshot.workspace.reportingCurrency) });
  if (cards.length > 0) kpiRow(doc, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  if (ch.atRiskCohorts.length > 0) {
    const y = cards.length > 0 ? CONTENT_TOP + 2.25 * IN : CONTENT_TOP;
    const h = FOOTER_RULE_Y - y - 0.4 * IN;
    card(doc, MARGIN, y, CONTENT_W, h);
    cardHeading(doc, 'Cohorts worth acting on', MARGIN + 30, y + 26, CONTENT_W - 60);
    ch.atRiskCohorts.forEach((c, i) => {
      const rowY = y + 76 + i * 72;
      doc.fillColor(hex(COLORS.ink)).font(FONT_BOLD).fontSize(16.5).text(c.label, MARGIN + 30, rowY, { width: CONTENT_W - 300, lineBreak: false });
      doc
        .fillColor(hex(COLORS.ink))
        .font(FONT_BOLD)
        .fontSize(16.5)
        .text(`${c.count} customers`, MARGIN + CONTENT_W - 250, rowY, { width: 220, align: 'right', lineBreak: false });
    });
  }

  footer(doc, snapshot);
}

function renderRecommendations(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  canvas(doc);
  const recs = snapshot.recommendations.slice(0, 6);
  header(doc, 'Prioritised Recommendations', `${recs.length} action${recs.length === 1 ? '' : 's'}, ordered by expected impact`, pageLabel);

  const available = FOOTER_RULE_Y - CONTENT_TOP - 0.4 * IN;
  const gap = 16;
  const cardH = Math.min(1.32 * IN, (available - gap * (recs.length - 1)) / Math.max(recs.length, 1));
  recs.forEach((r, i) => {
    const y = CONTENT_TOP + i * (cardH + gap);
    const accent = r.priority === 'high' ? COLORS.negative : r.priority === 'medium' ? COLORS.warningAccent : COLORS.grayLight;
    card(doc, MARGIN, y, CONTENT_W, cardH);
    doc.rect(MARGIN, y + 13, 5, cardH - 26).fill(hex(accent));
    doc.fillColor(hex(COLORS.grayLight)).font(FONT_BOLD).fontSize(16.5).text(String(i + 1).padStart(2, '0'), MARGIN + 30, y + 20, { width: 50, lineBreak: false });
    pill(
      doc,
      r.priority.toUpperCase(),
      r.priority === 'high' ? COLORS.negativeBg : r.priority === 'medium' ? COLORS.warningBg : COLORS.canvas,
      r.priority === 'high' ? COLORS.negative : r.priority === 'medium' ? COLORS.warning : COLORS.grayLight,
      MARGIN + 90,
      y + 22,
      76,
    );
    doc.fillColor(hex(COLORS.ink)).font(FONT).fontSize(16.5).text(r.text, MARGIN + 180, y + 20, { width: CONTENT_W - 220 });
  });

  footer(doc, snapshot);
}

function renderRoadmap(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  const roadmap = snapshot.strategicRoadmap;
  if (!roadmap) return;
  canvas(doc);
  header(doc, 'Strategic Action Roadmap', "Sequenced from this report's findings", pageLabel);

  const cardH = FOOTER_RULE_Y - CONTENT_TOP - 0.4 * IN;
  const gap = 23;
  const colW = (CONTENT_W - gap * (roadmap.length - 1)) / roadmap.length;
  roadmap.forEach((phase, i) => {
    const x = MARGIN + i * (colW + gap);
    card(doc, x, CONTENT_TOP, colW, cardH);
    doc.rect(x + 30, CONTENT_TOP + 30, 36, 5).fill(hex(COLORS.brandAccent));
    eyebrow(doc, `Phase ${String(phase.phase).padStart(2, '0')}`, x + 30, CONTENT_TOP + 52, colW - 60, COLORS.brandAccent);
    doc.fillColor(hex(COLORS.ink)).font(FONT_BOLD).fontSize(22).text(phase.title, x + 30, CONTENT_TOP + 80, { width: colW - 60 });
    doc.fillColor(hex(COLORS.gray)).font(FONT).fontSize(16.5).text(phase.description, x + 30, CONTENT_TOP + 144, { width: colW - 60 });
  });

  footer(doc, snapshot);
}

function renderMethodology(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  canvas(doc);
  header(doc, 'Methodology, Privacy & Data Sources', 'How this report was built', pageLabel);

  const m = snapshot.methodology;
  const cardH = FOOTER_RULE_Y - CONTENT_TOP - 0.4 * IN;
  const colGap = 0.58 * IN;
  const colW = (CONTENT_W - colGap) / 2;

  card(doc, MARGIN, CONTENT_TOP, colW, cardH);
  cardHeading(doc, 'Data sources', MARGIN + 30, CONTENT_TOP + 26, colW - 60);
  m.dataSources.forEach((source, i) => {
    const y = CONTENT_TOP + 72 + i * 84;
    doc.fillColor(hex(COLORS.ink)).font(FONT_BOLD).fontSize(16.5).text(source.name, MARGIN + 30, y, { width: colW - 60, lineBreak: false });
    doc.fillColor(hex(COLORS.gray)).font(FONT).fontSize(14).text(source.description, MARGIN + 30, y + 24, { width: colW - 60 });
  });

  const rx = MARGIN + colW + colGap;
  card(doc, rx, CONTENT_TOP, colW, cardH);
  cardHeading(doc, 'Limitations', rx + 30, CONTENT_TOP + 26, colW - 60);
  m.limitations.forEach((limitation, i) => {
    const y = CONTENT_TOP + 72 + i * 84;
    doc.rect(rx + 30, y + 6, 4, 36).fill(hex(COLORS.warningAccent));
    doc.fillColor(hex(COLORS.ink)).font(FONT).fontSize(14).text(limitation, rx + 54, y, { width: colW - 90 });
  });

  doc
    .fillColor(hex(COLORS.grayLight))
    .font(FONT)
    .fontSize(12)
    .text(
      `Report status: ${snapshot.privacy.approval.status}${snapshot.privacy.approval.reviewedBy ? ` · Reviewed by ${snapshot.privacy.approval.reviewedBy}` : ''}`,
      rx + 30,
      CONTENT_TOP + cardH - 46,
      { width: colW - 60 },
    );

  footer(doc, snapshot);
}

function renderAppendix(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  canvas(doc);
  header(doc, 'Appendix', 'Internal notes - never included in client-safe exports', pageLabel);

  const cardH = FOOTER_RULE_Y - CONTENT_TOP - 0.4 * IN;
  card(doc, MARGIN, CONTENT_TOP, CONTENT_W, cardH);
  const entries = Object.entries(snapshot.appendix ?? {}).filter(([key]) => key !== 'aiSummary');
  entries.forEach(([key, value], i) => {
    doc
      .fillColor(hex(COLORS.gray))
      .font(FONT)
      .fontSize(12)
      .text(`${key}: ${JSON.stringify(value)}`, MARGIN + 30, CONTENT_TOP + 36 + i * 36, { width: CONTENT_W - 60 });
  });

  footer(doc, snapshot);
}
