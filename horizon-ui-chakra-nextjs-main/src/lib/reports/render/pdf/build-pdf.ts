'server-only';

import PDFDocument from 'pdfkit';
import type { MarketSignalKind, ReportSnapshot } from '../../schema';
import { buildSectionPlan, appendixEntries, type PlannedSection, type SectionPlan, ROWS_PER_TABLE_PAGE } from '../../section-plan';
import { COLORS, formatCurrency, formatDate, formatMetricName, formatPercent } from '../../design-tokens';
import { median } from '../../metrics/statistics';
import { safeRatio } from '../../metrics/growth';

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
        renderCover(doc, snapshot, plan);
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
  sparkline?: number[] | null;
}

const MIN_SPARKLINE_POINTS = 3;

function kpiRow(doc: PDFKit.PDFDocument, cards: KpiSpec[], x: number, y: number, w: number, h = 1.96 * IN) {
  if (cards.length === 0) return;
  const gap = 0.29 * IN;
  const cardW = (w - gap * (cards.length - 1)) / cards.length;
  cards.forEach((c, i) => {
    const cx = x + i * (cardW + gap);
    const pad = c.onDark ? 0 : 0.33 * IN;
    const hasSparkline = !c.onDark && (c.sparkline?.length ?? 0) >= MIN_SPARKLINE_POINTS;
    if (!c.onDark) doc.roundedRect(cx, y, cardW, h, CARD_RADIUS).fill(hex(COLORS.paper));
    doc
      .fillColor(hex(c.onDark ? COLORS.paper : COLORS.gray))
      .font(FONT_BOLD)
      .fontSize(12)
      .text(c.label.toUpperCase(), cx + pad, y + (c.onDark ? 0 : 0.29 * IN), {
        width: hasSparkline ? cardW - pad * 2 - 76 : cardW - pad * 2,
        characterSpacing: 1.2,
      });
    if (hasSparkline) {
      sparkline(doc, c.sparkline as number[], cx + cardW - pad - 72, y + 17, 72, 30);
    }
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

/** Tiny native vector trend line - no axes/gridlines, mirrors render/pptx/components.ts's addSparkline. */
function sparkline(doc: PDFKit.PDFDocument, values: number[], x: number, y: number, w: number, h: number, color: string = COLORS.brandAccent) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = w / Math.max(values.length - 1, 1);
  doc.save().lineWidth(1.5).strokeColor(hex(color));
  values.forEach((v, i) => {
    const px = x + i * stepX;
    const py = y + h - ((v - min) / span) * h;
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  });
  doc.stroke();
  doc.restore();
}

/** Deterministic badge for a market signal's kind - same mapping as render/pptx/components.ts's signalBadge. */
function signalBadge(kind: MarketSignalKind): { label: string; bg: string; fg: string } {
  switch (kind) {
    case 'price_war':
    case 'new_entrant':
      return { label: 'WATCH', bg: COLORS.warningBg, fg: COLORS.warning };
    case 'supply_void':
      return { label: 'OPENING', bg: COLORS.positiveBg, fg: COLORS.positive };
    case 'demand_rising':
      return { label: 'POSITION', bg: COLORS.infoBg, fg: COLORS.info };
  }
}

/** "82" -> "nd", "3" -> "rd", "11" -> "th", etc. */
function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/** Solid brand-purple insight card with optional bottom micro-metric row - mirrors render/pptx/components.ts's addInsightCard. */
function insightCard(
  doc: PDFKit.PDFDocument,
  eyebrowText: string,
  body: string,
  microMetrics: { label: string; value: string }[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.roundedRect(x, y, w, h, CARD_RADIUS).fill(hex(COLORS.brand));
  doc.save().opacity(0.85);
  doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(12).text(eyebrowText.toUpperCase(), x + 30, y + 30, { width: w - 60, characterSpacing: 1.5 });
  doc.restore();
  const bodyH = microMetrics.length > 0 ? h - 155 : h - 83;
  doc.fillColor(hex(COLORS.paper)).font(FONT).fontSize(16.5).text(body, x + 30, y + 60, { width: w - 60, height: bodyH });

  if (microMetrics.length > 0) {
    const stripY = y + h - 94;
    doc.rect(x + 30, stripY, w - 60, 1).fill(hex(COLORS.paper));
    const colW = (w - 60) / microMetrics.length;
    microMetrics.forEach((m, i) => {
      const mx = x + 30 + i * colW;
      doc.save().opacity(0.7);
      doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(11).text(m.label.toUpperCase(), mx, stripY + 16, { width: colW - 14, characterSpacing: 1 });
      doc.restore();
      doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(19).text(m.value, mx, stripY + 35, { width: colW - 14, lineBreak: false });
    });
  }
}

/** Small tinted-background callout card - used by competitor tracking's highlight column. */
function highlightCard(doc: PDFKit.PDFDocument, eyebrowText: string, title: string, body: string, bg: string, x: number, y: number, w: number, h: number) {
  doc.roundedRect(x, y, w, h, CARD_RADIUS).fill(hex(bg));
  eyebrow(doc, eyebrowText, x + 22, y + 16, w - 44, COLORS.gray);
  doc.fillColor(hex(COLORS.ink)).font(FONT_BOLD).fontSize(15).text(title, x + 22, y + 36, { width: w - 44, lineBreak: false });
  doc.fillColor(hex(COLORS.gray)).font(FONT).fontSize(12).text(body, x + 22, y + 58, { width: w - 44, height: h - 74 });
}

interface PriceLadderRung {
  label: string;
  valueText: string;
  value: number;
  color?: string;
  emphasized?: boolean;
}

/** Horizontal proportional-bar price ladder - mirrors render/pptx/components.ts's addPriceLadder. */
function priceLadder(doc: PDFKit.PDFDocument, rungs: PriceLadderRung[], x: number, y: number, w: number, pitch = 52) {
  const max = Math.max(...rungs.map((r) => r.value), 1);
  const trackW = w - 150;
  const trackH = 12;
  rungs.forEach((r, i) => {
    const rowY = y + i * pitch;
    doc
      .fillColor(hex(r.emphasized ? COLORS.ink : COLORS.gray))
      .font(r.emphasized ? FONT_BOLD : FONT)
      .fontSize(13.5)
      .text(r.label, x, rowY, { width: 158, lineBreak: false });
    doc.roundedRect(x, rowY + 23, trackW, trackH, trackH / 2).fill(hex(COLORS.canvas));
    const fillW = Math.max(trackW * Math.min(r.value / max, 1), 2);
    doc.roundedRect(x, rowY + 23, fillW, trackH, trackH / 2).fill(hex(r.color ?? COLORS.brandAccent));
    doc
      .fillColor(hex(COLORS.ink))
      .font(FONT_BOLD)
      .fontSize(13.5)
      .text(r.valueText, x + w - 133, rowY, { width: 133, align: 'right', lineBreak: false });
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

function renderCover(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, plan: SectionPlan) {
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

  // "This cycle covers" - included TOC entries, 2 columns. Only ever lists
  // what actually made it into the deck.
  const includedTitles = plan.toc.filter((e) => e.status === 'included').map((e) => e.title);
  // Bottom edge of the two-column list below, used to keep the divider/KPI
  // strip from overlapping it - see the comment where it's consumed.
  let listBottomY = 6.84;
  if (includedTitles.length > 0) {
    doc.save().opacity(0.7);
    doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(12).text('THIS CYCLE COVERS', MARGIN, 6.56 * IN, { width: panelW - MARGIN * 2, characterSpacing: 1.5 });
    doc.restore();
    const colW = (panelW - MARGIN * 2 - 22) / 2;
    const perCol = Math.ceil(includedTitles.length / 2);
    doc.save().opacity(0.92);
    includedTitles.forEach((title, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      doc
        .fillColor(hex(COLORS.paper))
        .font(FONT)
        .fontSize(14)
        .text(`•  ${title}`, MARGIN + col * (colW + 22), (6.92 + row * 0.38) * IN, { width: colW, lineBreak: false });
    });
    doc.restore();
    listBottomY = 6.92 + perCol * 0.38;
  }

  const cards: KpiSpec[] = [];
  const currency = snapshot.workspace.reportingCurrency;
  if (snapshot.revenue) {
    cards.push(growthKpi('Revenue', snapshot.revenue.revenue, (v) => formatCurrency(v, currency), true));
    cards.push(growthKpi('Orders', snapshot.revenue.orders, (v) => String(Math.round(v)), true));
  }
  if (snapshot.marketplacePerformance?.priceIndex) {
    cards.push({ label: 'Price index', value: snapshot.marketplacePerformance.priceIndex.value.toFixed(0), delta: 'vs. market', onDark: true });
  }
  if (cards.length > 0) {
    // Only pushed down when the TOC list above actually needs the room (the
    // maximum 9-section case needs a 5th row that overlaps the fixed 8.5in
    // line otherwise) - the common case is pixel-identical to before.
    const dividerY = Math.max(8.5, listBottomY + 0.14);
    const kpiY = dividerY + 0.4;
    doc.rect(MARGIN, dividerY * IN, panelW - MARGIN * 2, 1).fill(hex(COLORS.paper));
    kpiRow(doc, cards, MARGIN, kpiY * IN, panelW - MARGIN * 2, 1.3 * IN);
  }

  // Right strip: minimal - metadata already lives on the left panel.
  doc
    .fillColor(hex(COLORS.gray))
    .font(FONT)
    .fontSize(13)
    .text(
      `Generated automatically from your store data and Ryvl's tracked market scan. Every figure traces to a source listed on the methodology page.`,
      panelW + 48,
      H - 1.4 * IN,
      { width: W - panelW - 96 },
    );

  confidentialityPill(doc, snapshot, W - MARGIN - 240, 0.667 * IN);
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
    cards.push({ ...growthKpi('Revenue', snapshot.revenue.revenue, (v) => formatCurrency(v, currency)), sparkline: snapshot.revenue.weeklySeries?.map((p) => p.value) ?? null });
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

  // Insight card (purple, ~55%) left, "what changed" (white, ~45%) right -
  // matches the reference deck's priority: the narrated read is primary.
  if (narrative) {
    const insightW = signals.length > 0 ? CONTENT_W * 0.55 : CONTENT_W;
    const microMetrics: { label: string; value: string }[] = [];
    if (snapshot.revenue) {
      const ordersChange = snapshot.revenue.orders.changePct;
      microMetrics.push({
        label: 'Order volume',
        value: ordersChange != null ? `${ordersChange >= 0 ? '+' : ''}${ordersChange.toFixed(1)}%` : String(Math.round(snapshot.revenue.orders.current)),
      });
      microMetrics.push({ label: 'Avg. order value', value: formatCurrency(snapshot.revenue.avgOrderValue.current, currency) });
    }
    if (snapshot.pricePositioning?.percentile != null) {
      microMetrics.push({ label: 'Market percentile', value: `${snapshot.pricePositioning.percentile}${ordinalSuffix(snapshot.pricePositioning.percentile)}` });
    }
    insightCard(doc, 'Ryvl insight', narrative, microMetrics.slice(0, 3), MARGIN, lowerY, insightW, lowerH);
  }

  if (signals.length > 0) {
    const signalsX = narrative ? MARGIN + CONTENT_W * 0.55 + 30 : MARGIN;
    const signalsW = narrative ? CONTENT_W * 0.45 - 30 : CONTENT_W;
    card(doc, signalsX, lowerY, signalsW, lowerH);
    cardHeading(doc, 'What changed this cycle', signalsX + 30, lowerY + 26, signalsW - 60);
    signals.forEach((signal, i) => {
      const sy = lowerY + 72 + i * 70;
      const badge = signalBadge(signal.kind);
      pill(doc, badge.label, badge.bg, badge.fg, signalsX + 30, sy, 68);
      doc.fillColor(hex(COLORS.ink)).font(FONT).fontSize(16.5).text(signal.description, signalsX + 30, sy + 30, { width: signalsW - 60 });
      if (i < signals.length - 1) doc.rect(signalsX + 30, sy + 66, signalsW - 60, 1).fill(hex(COLORS.hairlineSoft));
    });
  }

  footer(doc, snapshot);
}

function renderMarketPosition(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  const mp = snapshot.marketplacePerformance;
  if (!mp) return;
  canvas(doc);
  header(doc, 'Market Position & Benchmark Percentiles', `Tracked across ${mp.scope.platformNames.join(', ') || 'tracked marketplaces'}`, pageLabel);

  const percentile = snapshot.pricePositioning?.percentile ?? null;
  const cards: KpiSpec[] = [];
  if (mp.priceIndex) cards.push({ label: 'Price index vs. market', value: mp.priceIndex.value.toFixed(0), delta: '100 = at market median' });
  if (percentile != null) {
    cards.push({ label: 'Your percentile', value: `${percentile}${ordinalSuffix(percentile)}`, delta: 'Of the tracked price range' });
  }
  cards.push({ label: 'Platforms in scope', value: String(mp.scope.platformNames.length) });
  kpiRow(doc, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  const chartY = CONTENT_TOP + 2.25 * IN;
  const chartH = FOOTER_RULE_Y - chartY - 0.4 * IN;
  card(doc, MARGIN, chartY, CONTENT_W, chartH);
  cardHeading(doc, 'Where your price sits in the tracked market', MARGIN + 30, chartY + 26, CONTENT_W - 60);

  if (percentile != null) {
    barRows(
      doc,
      [
        { title: '25th percentile', valueText: '25', ratio: 0.25, color: COLORS.grayLight },
        { title: 'Your position', valueText: `${percentile}`, ratio: percentile / 100, color: COLORS.brandAccent },
        { title: '75th percentile', valueText: '75', ratio: 0.75, color: COLORS.grayLight },
      ],
      MARGIN + 30,
      chartY + 76,
      CONTENT_W - 60,
      86,
    );
    const read =
      percentile >= 75
        ? 'You price above three quarters of the tracked set.'
        : percentile >= 50
          ? 'You price above the market median, inside the upper half of the tracked set.'
          : percentile >= 25
            ? 'You price below the market median, inside the lower half of the tracked set.'
            : 'You price below three quarters of the tracked set.';
    doc.fillColor(hex(COLORS.gray)).font(FONT_ITALIC).fontSize(14).text(read, MARGIN + 30, chartY + chartH - 50, { width: CONTENT_W - 60 });
  }

  footer(doc, snapshot);
}

function renderPricingIntelligence(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  const pp = snapshot.pricePositioning;
  if (!pp) return;
  canvas(doc);
  header(doc, 'Pricing Intelligence', 'Your price against the tracked market median', pageLabel);

  const currency = snapshot.workspace.reportingCurrency;
  const gapPct = safeRatio(pp.yourMedianPrice.value - pp.marketMedian.value, pp.marketMedian.value);
  const cards: KpiSpec[] = [
    { label: 'Your price', value: formatCurrency(pp.yourMedianPrice.value, currency) },
    { label: 'Market median', value: formatCurrency(pp.marketMedian.value, currency) },
  ];
  if (gapPct != null) {
    const pct = gapPct * 100;
    cards.push({
      label: 'Gap',
      value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
      delta: pct >= 0 ? 'Above market median' : 'Below market median',
      deltaColor: pct >= 0 ? COLORS.positive : COLORS.negative,
    });
  }
  kpiRow(doc, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  const lowerY = CONTENT_TOP + 2.25 * IN;
  const lowerH = FOOTER_RULE_Y - lowerY - 0.4 * IN;
  const hasTrend = pp.trend != null && pp.trend.length >= 2;
  const ladderW = hasTrend ? CONTENT_W * 0.36 - 30 : CONTENT_W;
  const ladderX = hasTrend ? MARGIN + CONTENT_W * 0.64 + 30 : MARGIN;

  if (hasTrend) {
    card(doc, MARGIN, lowerY, CONTENT_W * 0.64, lowerH);
    cardHeading(doc, 'Market median price over time', MARGIN + 30, lowerY + 26, CONTENT_W * 0.64 - 60);
    lineChart(doc, pp.trend!.map((t) => t.medianPrice), pp.trend!.map((t) => formatDate(t.date)), MARGIN + 30, lowerY + 76, CONTENT_W * 0.64 - 60, lowerH - 108);
  }

  // Price ladder - only real rungs (your price, market median, recommended
  // band low/high) - no invented "lowest/highest tracked" the schema
  // doesn't carry.
  const ladderCardH = pp.recommendedBand ? lowerH - 133 : lowerH;
  card(doc, ladderX, lowerY, ladderW, ladderCardH);
  cardHeading(doc, 'Price ladder', ladderX + 30, lowerY + 26, ladderW - 60);

  const rungs: PriceLadderRung[] = [
    { label: 'Your price', valueText: formatCurrency(pp.yourMedianPrice.value, currency), value: pp.yourMedianPrice.value, color: COLORS.negative, emphasized: true },
  ];
  if (pp.recommendedBand) rungs.push({ label: 'Band - high', valueText: formatCurrency(pp.recommendedBand.high, currency), value: pp.recommendedBand.high, color: COLORS.brandAccent });
  rungs.push({ label: 'Market median', valueText: formatCurrency(pp.marketMedian.value, currency), value: pp.marketMedian.value, color: COLORS.grayLight });
  if (pp.recommendedBand) rungs.push({ label: 'Band - low', valueText: formatCurrency(pp.recommendedBand.low, currency), value: pp.recommendedBand.low, color: COLORS.info });
  priceLadder(doc, rungs, ladderX + 30, lowerY + 76, ladderW - 60);

  if (pp.recommendedBand) {
    const bandY = lowerY + ladderCardH + 18;
    const bandH = lowerH - ladderCardH - 18;
    const inside = pp.yourMedianPrice.value >= pp.recommendedBand.low && pp.yourMedianPrice.value <= pp.recommendedBand.high;
    doc.roundedRect(ladderX, bandY, ladderW, bandH, CARD_RADIUS).fill(hex(COLORS.brand));
    doc.save().opacity(0.85);
    doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(12).text('RECOMMENDED BAND', ladderX + 23, bandY + 14, { width: ladderW - 46, characterSpacing: 1.2 });
    doc.restore();
    doc
      .fillColor(hex(COLORS.paper))
      .font(FONT_BOLD)
      .fontSize(22)
      .text(`${formatCurrency(pp.recommendedBand.low, currency)} – ${formatCurrency(pp.recommendedBand.high, currency)}`, ladderX + 23, bandY + 36, { width: ladderW - 46 });
    doc.save().opacity(0.9);
    doc
      .fillColor(hex(COLORS.paper))
      .font(FONT)
      .fontSize(13)
      .text(
        inside ? 'You are inside the recommended band.' : `You are outside the recommended band, on the ${pp.yourMedianPrice.value > pp.recommendedBand.high ? 'high' : 'low'} side.`,
        ladderX + 23,
        bandY + bandH - 30,
        { width: ladderW - 46 },
      );
    doc.restore();
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

  // Highlight cards only on the primary page - continuation pages get the
  // full table width instead of repeating them.
  const showHighlights = section.page === 0;
  const tableW = showHighlights ? CONTENT_W * 0.68 : CONTENT_W;
  card(doc, MARGIN, CONTENT_TOP, tableW, cardH);

  const inner = tableW - 60;
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

  if (showHighlights) {
    const hx = MARGIN + tableW + 30;
    const hw = CONTENT_W - tableW - 30;
    const rowH = (cardH - 32) / 3;

    const mostActive = cb.scorecards.filter((r) => r.repricingRate != null).reduce<typeof cb.scorecards[number] | null>(
      (best, r) => (best == null || r.repricingRate! > best.repricingRate! ? r : best),
      null,
    );
    if (mostActive) {
      highlightCard(
        doc,
        'MOST ACTIVE REPRICER',
        mostActive.competitorName,
        `Repricing ${formatPercent(mostActive.repricingRate! * 100, 0)} of tracked SKUs this cycle on ${mostActive.platformName}.`,
        COLORS.warningBg,
        hx,
        CONTENT_TOP,
        hw,
        rowH,
      );
    }

    const supplyVoidCandidate = cb.scorecards.filter((r) => r.skuCount >= 5).reduce<typeof cb.scorecards[number] | null>(
      (worst, r) => (worst == null || r.inStockRate < worst.inStockRate ? r : worst),
      null,
    );
    // A tie at 100% in-stock across every eligible competitor is not a
    // finding - reduce still returns someone, which used to render
    // "SUPPLY VOID ... Only 100% in stock", contradicting its own headline.
    if (supplyVoidCandidate && supplyVoidCandidate.inStockRate < 1) {
      highlightCard(
        doc,
        'SUPPLY VOID',
        supplyVoidCandidate.competitorName,
        `Only ${formatPercent(supplyVoidCandidate.inStockRate * 100, 0)} in stock across ${supplyVoidCandidate.skuCount} tracked SKUs on ${supplyVoidCandidate.platformName}.`,
        COLORS.positiveBg,
        hx,
        CONTENT_TOP + rowH + 16,
        hw,
        rowH,
      );
    }

    const medianPrices = cb.scorecards.map((r) => r.medianPrice.value);
    const inStockRates = cb.scorecards.map((r) => r.inStockRate);
    const repricingRates = cb.scorecards.map((r) => r.repricingRate).filter((v): v is number => v != null);
    const medPrice = median(medianPrices);
    const medStock = median(inStockRates);
    const medReprice = repricingRates.length > 0 ? median(repricingRates) : null;
    if (medPrice != null) {
      const parts = [`Median price ${formatCurrency(medPrice, currency)}`];
      if (medStock != null) parts.push(`${formatPercent(medStock * 100, 0)} in stock`);
      if (medReprice != null) parts.push(`${formatPercent(medReprice * 100, 0)} repricing rate`);
      highlightCard(doc, 'TRACKED-SET MEDIANS', 'Across all tracked competitors', parts.join(' · '), COLORS.canvas, hx, CONTENT_TOP + (rowH + 16) * 2, hw, rowH);
    }
  }

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
    if (sku.daysOfCoverEstimate != null) {
      const critical = sku.daysOfCoverEstimate < 7;
      pill(
        doc,
        `${Math.round(sku.daysOfCoverEstimate)}d cover left`,
        critical ? COLORS.negativeBg : COLORS.warningBg,
        critical ? COLORS.negative : COLORS.warning,
        MARGIN + leftW - 170,
        y + 4,
        140,
      );
    } else {
      pill(doc, 'Below threshold', COLORS.warningBg, COLORS.warning, MARGIN + leftW - 150, y + 4, 120);
    }
    if (i < ir.stockoutRiskSkus.length - 1) doc.rect(MARGIN + 30, y + 52, leftW - 60, 1).fill(hex(COLORS.hairlineSoft));
  });

  const sellerCategories = new Set((snapshot.productPerformance?.categoryBreakdown ?? []).map((c) => c.category.toLowerCase()));
  let overlapCount = 0;

  if (hasVoids) {
    const rx = MARGIN + leftW + 30;
    const rw = CONTENT_W - leftW - 30;
    const netPositionH = 1.6 * IN;
    const voidsH = cardH - netPositionH - 0.24 * IN;
    card(doc, rx, CONTENT_TOP, rw, voidsH);
    cardHeading(doc, 'Demand you can absorb', rx + 30, CONTENT_TOP + 26, rw - 60);
    eyebrow(doc, 'Tracked competitors currently out of stock', rx + 30, CONTENT_TOP + 58, rw - 60);
    ir.supplyVoidOpportunities!.slice(0, 5).forEach((op, i) => {
      const y = CONTENT_TOP + 100 + i * 56;
      const overlaps = sellerCategories.has(op.category.toLowerCase());
      if (overlaps) overlapCount += 1;
      doc.rect(rx + 22, y - 2, 4, 40).fill(hex(overlaps ? COLORS.positive : COLORS.hairline));
      doc.fillColor(hex(COLORS.ink)).font(FONT_BOLD).fontSize(16.5).text(op.competitorName, rx + 40, y, { width: rw - 200, lineBreak: false });
      doc.fillColor(hex(COLORS.grayLight)).font(FONT).fontSize(13.5).text(op.platformName, rx + 40, y + 22, { width: rw - 200, lineBreak: false });
      pill(
        doc,
        overlaps ? 'In your catalogue' : 'Out of stock',
        overlaps ? COLORS.positiveBg : COLORS.canvas,
        overlaps ? COLORS.positive : COLORS.grayLight,
        rx + rw - 150,
        y + 4,
        120,
      );
    });

    const netY = CONTENT_TOP + voidsH + 0.24 * IN;
    const netSentence =
      overlapCount > 0
        ? `${overlapCount} of your ${ir.lowStockSkuCount} at-risk SKUs sit in categories where a tracked competitor is currently out of stock - restocking those first captures demand competitors can't currently serve.`
        : `None of the tracked supply voids overlap your own catalogue's categories this cycle.`;
    doc.roundedRect(rx, netY, rw, netPositionH, CARD_RADIUS).fill(hex(COLORS.brand));
    doc.save().opacity(0.85);
    doc.fillColor(hex(COLORS.paper)).font(FONT_BOLD).fontSize(12).text('NET POSITION', rx + 24, netY + 20, { width: rw - 48, characterSpacing: 1.2 });
    doc.restore();
    doc.fillColor(hex(COLORS.paper)).font(FONT).fontSize(14).text(netSentence, rx + 24, netY + 44, { width: rw - 48, height: netPositionH - 60 });
  }

  footer(doc, snapshot);
}

function renderPortfolio(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  const pp = snapshot.productPerformance;
  if (!pp) return;
  canvas(doc);
  const basis = pp.contributionBasis === 'revenue' ? 'by revenue' : 'by inventory value (per-sale line items are not tracked yet)';
  header(doc, 'Product Portfolio Contribution', `Category mix ${basis}`, pageLabel);

  const sorted = [...pp.categoryBreakdown].sort((a, b) => b.share - a.share);
  const hasConcentration = sorted.length >= 2;
  const barsH = hasConcentration ? FOOTER_RULE_Y - CONTENT_TOP - 0.4 * IN - 1.6 * IN - 0.24 * IN : FOOTER_RULE_Y - CONTENT_TOP - 0.4 * IN;

  card(doc, MARGIN, CONTENT_TOP, CONTENT_W, barsH);
  cardHeading(doc, 'Category share', MARGIN + 30, CONTENT_TOP + 26, CONTENT_W - 60);

  const maxShare = Math.max(...pp.categoryBreakdown.map((c) => c.share), 0.0001);
  barRows(
    doc,
    sorted.slice(0, 5).map((c) => ({ title: c.category, valueText: formatPercent(c.share * 100, 1), ratio: c.share / maxShare })),
    MARGIN + 30,
    CONTENT_TOP + 76,
    CONTENT_W - 60,
    76,
  );

  if (hasConcentration) {
    const topTwoShare = sorted.slice(0, 2).reduce((sum, c) => sum + c.share, 0);
    const panelY = CONTENT_TOP + barsH + 0.24 * IN;
    insightPanel(
      doc,
      'Concentration',
      `Your top two categories - ${sorted[0].category} and ${sorted[1].category} - make up ${formatPercent(topTwoShare * 100, 1)} of tracked ${pp.contributionBasis === 'revenue' ? 'revenue' : 'inventory value'}.`,
      MARGIN,
      panelY,
      CONTENT_W,
      1.6 * IN,
    );
  }

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
  const cols = recs.length > 1 ? 2 : 1;
  const rows = Math.ceil(recs.length / cols);
  const colGap = 24;
  const rowGap = 20;
  const cardW = (CONTENT_W - colGap * (cols - 1)) / cols;
  const cardH = Math.min(2.15 * IN, (available - rowGap * (rows - 1)) / Math.max(rows, 1));

  recs.forEach((r, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + colGap);
    const y = CONTENT_TOP + row * (cardH + rowGap);
    const accent = r.priority === 'high' ? COLORS.negative : r.priority === 'medium' ? COLORS.warningAccent : COLORS.grayLight;
    card(doc, x, y, cardW, cardH);
    doc.rect(x, y, cardW, 6).fill(hex(accent));
    doc.fillColor(hex(COLORS.grayLight)).font(FONT_BOLD).fontSize(16.5).text(String(i + 1).padStart(2, '0'), x + 24, y + 24, { width: 50, lineBreak: false });
    // 76pt fit "HIGH"/"LOW" but let "MEDIUM" overflow the pill shape at the
    // same 12pt bold font - pill() uses lineBreak:false, so unlike pptx this
    // doesn't wrap, it just draws text past the rounded-rect edge instead.
    pill(
      doc,
      r.priority.toUpperCase(),
      r.priority === 'high' ? COLORS.negativeBg : r.priority === 'medium' ? COLORS.warningBg : COLORS.canvas,
      r.priority === 'high' ? COLORS.negative : r.priority === 'medium' ? COLORS.warning : COLORS.grayLight,
      x + 62,
      y + 26,
      94,
    );
    doc.fillColor(hex(COLORS.ink)).font(FONT).fontSize(15.5).text(r.text, x + 24, y + 62, { width: cardW - 48, height: cardH - 120 });
    const timeframe = r.priority === 'high' ? 'Act this week' : 'Next 30 days';
    doc.fillColor(hex(COLORS.grayLight)).font(FONT_BOLD).fontSize(12).text(timeframe.toUpperCase(), x + 24, y + cardH - 34, { width: cardW - 48, characterSpacing: 1 });
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
  const colGap = 0.4 * IN;
  const colW = (CONTENT_W - colGap * 2) / 3;

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

  const sx = rx + colW + colGap;
  card(doc, sx, CONTENT_TOP, colW, cardH);
  cardHeading(doc, 'Report status', sx + 30, CONTENT_TOP + 26, colW - 60);
  const status = snapshot.privacy.approval.status;
  const statusTone =
    status === 'approved' ? { bg: COLORS.positiveBg, fg: COLORS.positive } : status === 'rejected' ? { bg: COLORS.negativeBg, fg: COLORS.negative } : { bg: COLORS.canvas, fg: COLORS.grayLight };
  pill(doc, formatMetricName(status), statusTone.bg, statusTone.fg, sx + 30, CONTENT_TOP + 72, colW - 60);
  if (snapshot.privacy.approval.reviewedBy) {
    doc
      .fillColor(hex(COLORS.gray))
      .font(FONT)
      .fontSize(14)
      .text(`Reviewed by ${snapshot.privacy.approval.reviewedBy}`, sx + 30, CONTENT_TOP + 120, { width: colW - 60 });
  }
  doc.rect(sx + 30, CONTENT_TOP + cardH - 90, colW - 60, 1).fill(hex(COLORS.hairlineSoft));
  doc
    .fillColor(hex(COLORS.grayLight))
    .font(FONT)
    .fontSize(12)
    .text(
      `Ref ${snapshot.metadata.reportId.slice(0, 8).toUpperCase()} · Generated ${formatDate(snapshot.metadata.generatedAt)}`,
      sx + 30,
      CONTENT_TOP + cardH - 68,
      { width: colW - 60 },
    );

  footer(doc, snapshot);
}

function renderAppendix(doc: PDFKit.PDFDocument, snapshot: ReportSnapshot, pageLabel: string) {
  canvas(doc);
  header(doc, 'Appendix', 'Internal notes - never included in client-safe exports', pageLabel);

  const cardH = FOOTER_RULE_Y - CONTENT_TOP - 0.4 * IN;
  card(doc, MARGIN, CONTENT_TOP, CONTENT_W, cardH);
  const entries = appendixEntries(snapshot.appendix);
  entries.forEach(([key, value], i) => {
    doc
      .fillColor(hex(COLORS.gray))
      .font(FONT)
      .fontSize(12)
      .text(`${key}: ${JSON.stringify(value)}`, MARGIN + 30, CONTENT_TOP + 36 + i * 36, { width: CONTENT_W - 60 });
  });

  footer(doc, snapshot);
}
