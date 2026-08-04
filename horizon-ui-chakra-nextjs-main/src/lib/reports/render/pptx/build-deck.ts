'server-only';

import pptxgen from 'pptxgenjs';
import type { ReportSnapshot } from '../../schema';
import { buildSectionPlan, type PlannedSection, type SectionPlan, ROWS_PER_TABLE_PAGE } from '../../section-plan';
import { COLORS, FONT_FAMILY, formatCurrency, formatDate, formatPercent } from '../../design-tokens';
import {
  SLIDE_W,
  SLIDE_H,
  MARGIN,
  CONTENT_W,
  CONTENT_TOP,
  TYPE,
  addCanvas,
  addHeader,
  addFooter,
  addCard,
  addCardHeading,
  addEyebrow,
  addKpiCardRow,
  kpiCardFromGrowth,
  addPill,
  addBarRows,
  addDataRows,
  addInsightPanel,
  addRecommendationCard,
  addSectionDivider,
  addConfidentialityPill,
  addNativeBarChart,
  addNativeLineChart,
  type KpiCardSpec,
  type BarRowSpec,
} from './components';

// Generates the entire deck from scratch, in code - no base .pptx template
// file is loaded or modified. Layout, palette and type scale mirror the
// approved reference deck (docs/report-reference/new-slides/New_Slides.pptx),
// but every element here is a native OOXML object (text/table/chart/shape)
// via pptxgenjs, so the output is genuinely editable in PowerPoint. There is
// deliberately no addImage call in this file: the reference deck pasted
// pre-rendered pictures for some of its charts, which is exactly the
// flattened-image failure mode the brief forbids.
export async function buildReportDeck(snapshot: ReportSnapshot): Promise<Buffer> {
  const plan = buildSectionPlan(snapshot);
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'RYVL_WIDE', width: SLIDE_W, height: SLIDE_H });
  pptx.layout = 'RYVL_WIDE';
  pptx.author = 'Ryvl';
  pptx.company = 'Ryvl';
  pptx.title = `${snapshot.workspace.businessName} - ${snapshot.metadata.period.label}`;

  // One running index across the whole deck - the "NN" label in every header
  // comes from here, so it always matches the deck's real, data-driven length.
  let slideIndex = 0;
  const label = () => {
    slideIndex += 1;
    return String(slideIndex).padStart(2, '0');
  };

  for (const section of plan.sections) {
    switch (section.kind) {
      case 'cover':
        slideIndex += 1;
        buildCoverSlide(pptx, snapshot);
        break;
      case 'toc':
        buildTocSlide(pptx, snapshot, plan, label());
        break;
      case 'section_divider':
        slideIndex += 1;
        addSectionDivider(
          pptx,
          section.chapterNumber ?? 1,
          section.chapterTotal ?? 1,
          section.title,
          section.dividerSubtitle ?? '',
          section.dividerStats ?? [],
          snapshot.metadata.mode,
        );
        break;
      case 'executive_snapshot':
        buildExecutiveSnapshotSlide(pptx, snapshot, label());
        break;
      case 'market_position':
        buildMarketPositionSlide(pptx, snapshot, label());
        break;
      case 'pricing_intelligence':
        buildPricingIntelligenceSlide(pptx, snapshot, label());
        break;
      case 'competitor_tracking':
        buildCompetitorTrackingSlide(pptx, snapshot, section, label());
        break;
      case 'sku_performance':
        buildSkuPerformanceSlide(pptx, snapshot, section, label());
        break;
      case 'inventory_risk':
        buildInventoryRiskSlide(pptx, snapshot, label());
        break;
      case 'portfolio_contribution':
        buildPortfolioSlide(pptx, snapshot, label());
        break;
      case 'customer_health':
        buildCustomerHealthSlide(pptx, snapshot, label());
        break;
      case 'recommendations':
        buildRecommendationsSlide(pptx, snapshot, label());
        break;
      case 'roadmap':
        buildRoadmapSlide(pptx, snapshot, label());
        break;
      case 'methodology':
        buildMethodologySlide(pptx, snapshot, label());
        break;
      case 'appendix':
        buildAppendixSlide(pptx, snapshot, label());
        break;
    }
  }

  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
}

function sourceLine(snapshot: ReportSnapshot): string {
  return `Source: ${snapshot.methodology.dataSources.map((s) => s.name).join(' - ')}  ·  Generated ${formatDate(snapshot.metadata.generatedAt)}`;
}

// -- Cover -------------------------------------------------------------

function buildCoverSlide(pptx: pptxgen, snapshot: ReportSnapshot): void {
  const slide = pptx.addSlide();
  addCanvas(slide, COLORS.canvas);

  // Split canvas: brand-purple content panel left, light strip right.
  const panelW = 14.042;
  slide.addShape('rect', { x: 0, y: 0, w: panelW, h: SLIDE_H, fill: { color: COLORS.brand }, line: { type: 'none' } });

  slide.addText('Ryvl', {
    x: MARGIN,
    y: 0.667,
    w: 3,
    h: 0.36,
    fontFace: FONT_FAMILY,
    fontSize: 18,
    bold: true,
    color: COLORS.paper,
  });
  slide.addText('SELLER MARKET INTELLIGENCE  ·  PERIODIC BRIEFING', {
    x: MARGIN,
    y: 2.6,
    w: panelW - MARGIN * 2,
    h: 0.32,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.kpiLabel,
    bold: true,
    color: COLORS.paper,
    charSpacing: 2,
    transparency: 35,
  });
  slide.addText(snapshot.workspace.businessName, {
    x: MARGIN,
    y: 3.2,
    w: panelW - MARGIN * 2,
    h: 1.8,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.coverTitle,
    bold: true,
    color: COLORS.paper,
  });
  slide.addText(
    snapshot.workspace.categories.length > 0
      ? `Market intelligence for ${snapshot.workspace.categories.map((c) => c.name).join(', ')}`
      : 'Seller market intelligence report',
    {
      x: MARGIN,
      y: 5.15,
      w: panelW - MARGIN * 2,
      h: 0.6,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.coverSubtitle,
      color: COLORS.paper,
      transparency: 20,
    },
  );
  slide.addText(
    `${snapshot.metadata.period.label}   ·   Generated ${formatDate(snapshot.metadata.generatedAt)}   ·   Ref: ${snapshot.metadata.reportId.slice(0, 8).toUpperCase()}`,
    {
      x: MARGIN,
      y: 6.1,
      w: panelW - MARGIN * 2,
      h: 0.4,
      fontFace: FONT_FAMILY,
      fontSize: 14,
      color: COLORS.paper,
      transparency: 35,
    },
  );

  // Headline KPI strip along the bottom of the purple panel - only the
  // metrics that actually exist, never padded to a fixed count.
  const cards: KpiCardSpec[] = [];
  const currency = snapshot.workspace.reportingCurrency;
  if (snapshot.revenue) {
    cards.push(kpiCardFromGrowth('Revenue', snapshot.revenue.revenue, (v) => formatCurrency(v, currency), true));
    cards.push(kpiCardFromGrowth('Orders', snapshot.revenue.orders, (v) => String(Math.round(v)), true));
  }
  if (snapshot.competitorBenchmarks) {
    cards.push({
      label: 'Competitors tracked',
      valueText: String(snapshot.competitorBenchmarks.scorecards.length),
      onDark: true,
    });
  }
  if (cards.length > 0) {
    slide.addShape('rect', {
      x: MARGIN,
      y: 8.5,
      w: panelW - MARGIN * 2,
      h: 0.012,
      fill: { color: COLORS.paper },
      line: { type: 'none' },
    });
    addKpiCardRow(slide, cards, MARGIN, 8.9, panelW - MARGIN * 2, 1.3);
  }

  // Right strip: report metadata block, no decorative imagery.
  slide.addText('PREPARED FOR', {
    x: panelW + 0.75,
    y: 3.2,
    w: SLIDE_W - panelW - 1.5,
    h: 0.3,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.kpiLabel,
    bold: true,
    color: COLORS.grayLight,
    charSpacing: 1.2,
  });
  slide.addText(snapshot.workspace.businessName, {
    x: panelW + 0.75,
    y: 3.55,
    w: SLIDE_W - panelW - 1.5,
    h: 0.9,
    fontFace: FONT_FAMILY,
    fontSize: 22,
    bold: true,
    color: COLORS.ink,
  });
  slide.addText('REPORTING PERIOD', {
    x: panelW + 0.75,
    y: 4.7,
    w: SLIDE_W - panelW - 1.5,
    h: 0.3,
    fontFace: FONT_FAMILY,
    fontSize: TYPE.kpiLabel,
    bold: true,
    color: COLORS.grayLight,
    charSpacing: 1.2,
  });
  slide.addText(snapshot.metadata.period.label, {
    x: panelW + 0.75,
    y: 5.05,
    w: SLIDE_W - panelW - 1.5,
    h: 0.5,
    fontFace: FONT_FAMILY,
    fontSize: 18,
    color: COLORS.ink,
  });

  addConfidentialityPill(slide, snapshot.metadata.mode, SLIDE_W - MARGIN - 2.42, 10.5);
}

// -- Table of contents ---------------------------------------------------

function buildTocSlide(pptx: pptxgen, snapshot: ReportSnapshot, plan: SectionPlan, pageLabel: string): void {
  const slide = pptx.addSlide();
  addCanvas(slide);
  addHeader(
    slide,
    "What's in this report",
    `${plan.includedSectionCount} of ${plan.candidateSectionCount} sections have enough tracked data this cycle`,
    pageLabel,
  );

  const colGap = 0.58;
  const colW = (CONTENT_W - colGap) / 2;
  const rowPitch = 0.663;
  const perColumn = Math.ceil(plan.toc.length / 2);
  const cardH = perColumn * rowPitch + 0.75;

  [0, 1].forEach((col) => {
    const entries = plan.toc.slice(col * perColumn, (col + 1) * perColumn);
    if (entries.length === 0) return;
    const x = MARGIN + col * (colW + colGap);
    addCard(slide, x, CONTENT_TOP, colW, cardH);

    entries.forEach((entry, i) => {
      const y = CONTENT_TOP + 0.46 + i * rowPitch;
      const included = entry.status === 'included';
      slide.addText(entry.number != null ? String(entry.number).padStart(2, '0') : '—', {
        x: x + 0.42,
        y,
        w: 0.7,
        h: 0.36,
        fontFace: FONT_FAMILY,
        fontSize: TYPE.rowSubtitle,
        bold: true,
        color: included ? COLORS.grayLight : COLORS.grayLightest,
      });
      slide.addText(entry.title, {
        x: x + 1.15,
        y: y - 0.04,
        w: colW - 3.6,
        h: 0.4,
        fontFace: FONT_FAMILY,
        fontSize: 18,
        bold: included,
        color: included ? COLORS.ink : COLORS.grayLight,
      });
      const pillText =
        entry.status === 'included' ? 'Included' : entry.status === 'omitted' ? 'Omitted' : 'Not enough data';
      addPill(
        slide,
        pillText,
        entry.status === 'included' ? 'positive' : 'neutral',
        x + colW - 2.1,
        y,
        1.68,
      );
      if (i < entries.length - 1) {
        slide.addShape('rect', {
          x: x + 0.42,
          y: y + rowPitch - 0.17,
          w: colW - 0.84,
          h: 0.012,
          fill: { color: COLORS.hairlineSoft },
          line: { type: 'none' },
        });
      }
    });
  });

  addInsightPanel(
    slide,
    'How this report is built',
    'Sections appear only when the underlying data supports them. Anything marked "not enough data" was considered and left out rather than shown with a misleading zero - the methodology page lists every source and limitation behind the numbers here.',
    MARGIN,
    CONTENT_TOP + cardH + 0.4,
    CONTENT_W,
    1.5,
  );

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Executive snapshot --------------------------------------------------

function buildExecutiveSnapshotSlide(pptx: pptxgen, snapshot: ReportSnapshot, pageLabel: string): void {
  const slide = pptx.addSlide();
  addCanvas(slide);
  addHeader(
    slide,
    'Executive Snapshot & Key Signals',
    `${snapshot.workspace.businessName} · ${snapshot.metadata.period.label}`,
    pageLabel,
  );

  const currency = snapshot.workspace.reportingCurrency;
  const cards: KpiCardSpec[] = [];
  if (snapshot.revenue) {
    cards.push(kpiCardFromGrowth('Revenue', snapshot.revenue.revenue, (v) => formatCurrency(v, currency)));
    cards.push(kpiCardFromGrowth('Orders', snapshot.revenue.orders, (v) => String(Math.round(v))));
  }
  if (snapshot.marketplacePerformance?.priceIndex) {
    cards.push({
      label: 'Price index',
      valueText: snapshot.marketplacePerformance.priceIndex.value.toFixed(0),
      deltaText: '100 = at market median',
    });
  }
  if (snapshot.inventoryRisk) {
    cards.push({
      label: 'Stockout risk SKUs',
      valueText: String(snapshot.inventoryRisk.lowStockSkuCount),
      deltaText: 'Below low-stock threshold',
    });
  }
  addKpiCardRow(slide, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  const lowerY = CONTENT_TOP + 2.25;
  const lowerH = 10.375 - lowerY - 0.4;
  const narrative = snapshot.appendix?.aiSummary as string | undefined;
  const signals = snapshot.marketSignals.slice(0, 4);

  if (signals.length > 0) {
    const signalsW = narrative ? CONTENT_W * 0.58 : CONTENT_W;
    addCard(slide, MARGIN, lowerY, signalsW, lowerH);
    addCardHeading(slide, 'What changed this cycle', MARGIN + 0.42, lowerY + 0.36, signalsW - 0.84);
    signals.forEach((signal, i) => {
      const sy = lowerY + 1.0 + i * 0.92;
      slide.addShape('rect', {
        x: MARGIN + 0.42,
        y: sy + 0.12,
        w: 0.06,
        h: 0.52,
        fill: { color: COLORS.brandAccent },
        line: { type: 'none' },
      });
      slide.addText(signal.description, {
        x: MARGIN + 0.75,
        y: sy,
        w: signalsW - 1.4,
        h: 0.76,
        fontFace: FONT_FAMILY,
        fontSize: TYPE.body,
        color: COLORS.ink,
        valign: 'middle',
      });
    });
  }

  if (narrative) {
    const panelX = signals.length > 0 ? MARGIN + CONTENT_W * 0.58 + 0.42 : MARGIN;
    const panelW = signals.length > 0 ? CONTENT_W * 0.42 - 0.42 : CONTENT_W;
    addInsightPanel(slide, 'Read', narrative, panelX, lowerY, panelW, lowerH);
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Market position -----------------------------------------------------

function buildMarketPositionSlide(pptx: pptxgen, snapshot: ReportSnapshot, pageLabel: string): void {
  const mp = snapshot.marketplacePerformance;
  if (!mp) return;
  const slide = pptx.addSlide();
  addCanvas(slide);
  addHeader(
    slide,
    'Market Position & Benchmark Percentiles',
    `Tracked across ${mp.scope.platformNames.join(', ') || 'tracked marketplaces'}`,
    pageLabel,
  );

  const cards: KpiCardSpec[] = [];
  if (mp.priceIndex) {
    cards.push({
      label: 'Price index vs. market',
      valueText: mp.priceIndex.value.toFixed(0),
      deltaText: '100 = at market median',
    });
  }
  if (snapshot.pricePositioning?.percentile != null) {
    cards.push({
      label: 'Your percentile',
      valueText: `${snapshot.pricePositioning.percentile}th`,
      deltaText: 'Of the tracked price range',
    });
  }
  cards.push({ label: 'Platforms in scope', valueText: String(mp.scope.platformNames.length) });
  addKpiCardRow(slide, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  const chartY = CONTENT_TOP + 2.25;
  const chartH = 10.375 - chartY - 0.4;
  addCard(slide, MARGIN, chartY, CONTENT_W, chartH);
  addCardHeading(slide, 'Where your price sits in the tracked market', MARGIN + 0.42, chartY + 0.36, CONTENT_W - 0.84);

  if (snapshot.pricePositioning?.percentile != null) {
    addNativeBarChart(
      slide,
      pptx,
      ['25th pct', 'You', '75th pct'],
      [25, snapshot.pricePositioning.percentile, 75],
      MARGIN + 0.42,
      chartY + 1.0,
      CONTENT_W - 0.84,
      chartH - 1.5,
    );
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Pricing intelligence -------------------------------------------------

function buildPricingIntelligenceSlide(pptx: pptxgen, snapshot: ReportSnapshot, pageLabel: string): void {
  const pp = snapshot.pricePositioning;
  if (!pp) return;
  const slide = pptx.addSlide();
  addCanvas(slide);
  addHeader(slide, 'Pricing Intelligence', 'Your price against the tracked market median', pageLabel);

  const currency = snapshot.workspace.reportingCurrency;
  const cards: KpiCardSpec[] = [
    { label: 'Your price', valueText: formatCurrency(pp.yourMedianPrice.value, currency) },
    { label: 'Market median', valueText: formatCurrency(pp.marketMedian.value, currency) },
  ];
  if (pp.recommendedBand) {
    cards.push({
      label: 'Supported band',
      valueText: `${formatCurrency(pp.recommendedBand.low, currency)} – ${formatCurrency(pp.recommendedBand.high, currency)}`,
    });
  }
  addKpiCardRow(slide, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  const lowerY = CONTENT_TOP + 2.25;
  const lowerH = 10.375 - lowerY - 0.4;

  if (pp.trend && pp.trend.length >= 2) {
    addCard(slide, MARGIN, lowerY, CONTENT_W, lowerH);
    addCardHeading(slide, 'Market median price over time', MARGIN + 0.42, lowerY + 0.36, CONTENT_W - 0.84);
    addNativeLineChart(
      slide,
      pptx,
      pp.trend.map((t) => formatDate(t.date)),
      [{ name: 'Market median', values: pp.trend.map((t) => t.medianPrice) }],
      MARGIN + 0.42,
      lowerY + 1.0,
      CONTENT_W - 0.84,
      lowerH - 1.5,
    );
  } else {
    // No trend series - show the price ladder as proportional bars instead
    // of leaving a card empty or faking a chart from two points.
    addCard(slide, MARGIN, lowerY, CONTENT_W, lowerH);
    addCardHeading(slide, 'Your price against the tracked range', MARGIN + 0.42, lowerY + 0.36, CONTENT_W - 0.84);
    const max = Math.max(pp.yourMedianPrice.value, pp.marketMedian.value, pp.recommendedBand?.high ?? 0) || 1;
    const rows: BarRowSpec[] = [
      {
        title: 'Your price',
        valueText: formatCurrency(pp.yourMedianPrice.value, currency),
        ratio: pp.yourMedianPrice.value / max,
        color: COLORS.brandAccent,
      },
      {
        title: 'Market median',
        valueText: formatCurrency(pp.marketMedian.value, currency),
        ratio: pp.marketMedian.value / max,
        color: COLORS.info,
      },
    ];
    if (pp.recommendedBand) {
      rows.push({
        title: 'Top of supported band',
        valueText: formatCurrency(pp.recommendedBand.high, currency),
        ratio: pp.recommendedBand.high / max,
        color: COLORS.grayLight,
      });
    }
    addBarRows(slide, rows, MARGIN + 0.42, lowerY + 1.1, CONTENT_W - 0.84);
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Competitor tracking (paginated) --------------------------------------

function buildCompetitorTrackingSlide(
  pptx: pptxgen,
  snapshot: ReportSnapshot,
  section: PlannedSection,
  pageLabel: string,
): void {
  const cb = snapshot.competitorBenchmarks;
  if (!cb || !section.rowRange) return;
  const slide = pptx.addSlide();
  addCanvas(slide);
  addHeader(slide, section.title, cb.marketDefinitionSummary, pageLabel);

  const currency = snapshot.workspace.reportingCurrency;
  const rows = cb.scorecards.slice(section.rowRange[0], section.rowRange[1]);
  const cardH = 10.375 - CONTENT_TOP - 0.4;
  addCard(slide, MARGIN, CONTENT_TOP, CONTENT_W, cardH);

  const colWidths = [CONTENT_W * 0.28, CONTENT_W * 0.16, CONTENT_W * 0.12, CONTENT_W * 0.16, CONTENT_W * 0.13, CONTENT_W * 0.15];
  addDataRows(
    slide,
    ['Competitor', 'Platform', 'SKUs', 'Median price', 'In stock', 'Repricing rate'],
    rows.map((r) => [
      r.competitorName,
      r.platformName,
      r.skuCount,
      formatCurrency(r.medianPrice.value, currency),
      formatPercent(r.inStockRate * 100, 0),
      r.repricingRate != null ? formatPercent(r.repricingRate * 100, 0) : 'N/A',
    ]),
    colWidths,
    MARGIN + 0.42,
    CONTENT_TOP + 0.5,
    CONTENT_W - 0.84,
    0.86,
  );

  if (section.truncated) {
    slide.addText(
      `+${section.truncatedCount} more tracked competitors — the full list stays live in your Ryvl dashboard.`,
      {
        x: MARGIN + 0.42,
        y: CONTENT_TOP + 1.12 + ROWS_PER_TABLE_PAGE * 0.86,
        w: CONTENT_W - 0.84,
        h: 0.36,
        fontFace: FONT_FAMILY,
        fontSize: 14,
        italic: true,
        color: COLORS.gray,
      },
    );
  }

  slide.addText('Public marketplace signals only. Private seller data is never shown.', {
    x: MARGIN + 0.42,
    y: CONTENT_TOP + cardH - 0.62,
    w: CONTENT_W - 0.84,
    h: 0.3,
    fontFace: FONT_FAMILY,
    fontSize: 12,
    color: COLORS.grayLight,
  });

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- SKU performance (paginated) ------------------------------------------

function buildSkuPerformanceSlide(
  pptx: pptxgen,
  snapshot: ReportSnapshot,
  section: PlannedSection,
  pageLabel: string,
): void {
  const pp = snapshot.productPerformance;
  if (!pp || !section.rowRange) return;
  const slide = pptx.addSlide();
  addCanvas(slide);
  const basis = pp.contributionBasis === 'revenue' ? 'revenue' : 'inventory value';
  addHeader(slide, section.title, `Top products by ${basis} share`, pageLabel);

  const rows = pp.topProducts.slice(section.rowRange[0], section.rowRange[1]);
  const cardH = 10.375 - CONTENT_TOP - 0.4;
  addCard(slide, MARGIN, CONTENT_TOP, CONTENT_W, cardH);
  addCardHeading(slide, `Top products by ${basis} share`, MARGIN + 0.42, CONTENT_TOP + 0.36, CONTENT_W - 0.84);

  const maxShare = Math.max(...rows.map((r) => r.contributionShare ?? 0), 0.0001);
  addBarRows(
    slide,
    rows.map((r) => ({
      title: r.title,
      subtitle: r.sku,
      valueText: r.contributionShare != null ? formatPercent(r.contributionShare * 100, 1) : 'N/A',
      ratio: (r.contributionShare ?? 0) / maxShare,
    })),
    MARGIN + 0.42,
    CONTENT_TOP + 1.05,
    CONTENT_W - 0.84,
    1.24,
  );

  if (section.truncated) {
    slide.addText(`+${section.truncatedCount} more products — see your Ryvl dashboard for the full catalogue.`, {
      x: MARGIN + 0.42,
      y: CONTENT_TOP + cardH - 0.62,
      w: CONTENT_W - 0.84,
      h: 0.36,
      fontFace: FONT_FAMILY,
      fontSize: 14,
      italic: true,
      color: COLORS.gray,
    });
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Inventory risk ---------------------------------------------------------

function buildInventoryRiskSlide(pptx: pptxgen, snapshot: ReportSnapshot, pageLabel: string): void {
  const ir = snapshot.inventoryRisk;
  if (!ir) return;
  const slide = pptx.addSlide();
  addCanvas(slide);
  addHeader(
    slide,
    'Inventory & Demand Risk',
    `${ir.lowStockSkuCount} SKUs below your low-stock threshold`,
    pageLabel,
  );

  const hasVoids = (ir.supplyVoidOpportunities?.length ?? 0) > 0;
  const cardH = 10.375 - CONTENT_TOP - 0.4;
  const leftW = hasVoids ? CONTENT_W * 0.55 : CONTENT_W;

  addCard(slide, MARGIN, CONTENT_TOP, leftW, cardH);
  addCardHeading(slide, 'At risk of stocking out', MARGIN + 0.42, CONTENT_TOP + 0.36, leftW - 0.84);
  addEyebrow(
    slide,
    `${ir.lowStockSkuCount} flagged · ${Math.min(ir.stockoutRiskSkus.length, ir.lowStockSkuCount)} shown`,
    MARGIN + 0.42,
    CONTENT_TOP + 0.8,
    leftW - 0.84,
  );
  ir.stockoutRiskSkus.forEach((sku, i) => {
    const y = CONTENT_TOP + 1.35 + i * 0.9;
    slide.addText(sku.title, {
      x: MARGIN + 0.42,
      y,
      w: leftW - 2.6,
      h: 0.36,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.rowTitle,
      bold: true,
      color: COLORS.ink,
    });
    if (sku.sku) {
      slide.addText(sku.sku, {
        x: MARGIN + 0.42,
        y: y + 0.32,
        w: leftW - 2.6,
        h: 0.28,
        fontFace: FONT_FAMILY,
        fontSize: TYPE.rowSubtitle,
        color: COLORS.grayLight,
      });
    }
    addPill(slide, 'Below threshold', 'warning', MARGIN + leftW - 2.1, y + 0.06, 1.68);
    if (i < ir.stockoutRiskSkus.length - 1) {
      slide.addShape('rect', {
        x: MARGIN + 0.42,
        y: y + 0.76,
        w: leftW - 0.84,
        h: 0.012,
        fill: { color: COLORS.hairlineSoft },
        line: { type: 'none' },
      });
    }
  });

  if (hasVoids) {
    const rightX = MARGIN + leftW + 0.42;
    const rightW = CONTENT_W - leftW - 0.42;
    addCard(slide, rightX, CONTENT_TOP, rightW, cardH);
    addCardHeading(slide, 'Demand you can absorb', rightX + 0.42, CONTENT_TOP + 0.36, rightW - 0.84);
    addEyebrow(
      slide,
      'Tracked competitors currently out of stock',
      rightX + 0.42,
      CONTENT_TOP + 0.8,
      rightW - 0.84,
    );
    ir.supplyVoidOpportunities!.slice(0, 5).forEach((op, i) => {
      const y = CONTENT_TOP + 1.35 + i * 0.78;
      slide.addText(op.competitorName, {
        x: rightX + 0.42,
        y,
        w: rightW - 2.4,
        h: 0.36,
        fontFace: FONT_FAMILY,
        fontSize: TYPE.rowTitle,
        bold: true,
        color: COLORS.ink,
      });
      slide.addText(op.platformName, {
        x: rightX + 0.42,
        y: y + 0.32,
        w: rightW - 2.4,
        h: 0.28,
        fontFace: FONT_FAMILY,
        fontSize: TYPE.rowSubtitle,
        color: COLORS.grayLight,
      });
      addPill(slide, 'Out of stock', 'positive', rightX + rightW - 1.95, y + 0.06, 1.53);
    });
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Portfolio contribution ---------------------------------------------------

function buildPortfolioSlide(pptx: pptxgen, snapshot: ReportSnapshot, pageLabel: string): void {
  const pp = snapshot.productPerformance;
  if (!pp) return;
  const slide = pptx.addSlide();
  addCanvas(slide);
  const basis =
    pp.contributionBasis === 'revenue'
      ? 'by revenue'
      : 'by inventory value (per-sale line items are not tracked yet)';
  addHeader(slide, 'Product Portfolio Contribution', `Category mix ${basis}`, pageLabel);

  const cardH = 10.375 - CONTENT_TOP - 0.4;
  addCard(slide, MARGIN, CONTENT_TOP, CONTENT_W, cardH);
  addCardHeading(slide, 'Category share', MARGIN + 0.42, CONTENT_TOP + 0.36, CONTENT_W - 0.84);

  const maxShare = Math.max(...pp.categoryBreakdown.map((c) => c.share), 0.0001);
  addBarRows(
    slide,
    pp.categoryBreakdown.slice(0, 6).map((c) => ({
      title: c.category,
      valueText: formatPercent(c.share * 100, 1),
      ratio: c.share / maxShare,
    })),
    MARGIN + 0.42,
    CONTENT_TOP + 1.05,
    CONTENT_W - 0.84,
    1.06,
  );

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Customer health -------------------------------------------------------

function buildCustomerHealthSlide(pptx: pptxgen, snapshot: ReportSnapshot, pageLabel: string): void {
  const ch = snapshot.customerHealth;
  if (!ch) return;
  const slide = pptx.addSlide();
  addCanvas(slide);
  addHeader(slide, 'Customer Health & Retention', 'From your own order and customer history', pageLabel);

  const cards: KpiCardSpec[] = [];
  if (ch.retentionRate) cards.push({ label: 'Retention rate', valueText: formatPercent(ch.retentionRate.current, 1) });
  if (ch.repeatPurchaseRate != null) {
    cards.push({ label: 'Repeat purchase rate', valueText: formatPercent(ch.repeatPurchaseRate, 1) });
  }
  if (ch.avgClv) {
    cards.push({
      label: 'Avg. customer LTV',
      valueText: formatCurrency(ch.avgClv.value, snapshot.workspace.reportingCurrency),
    });
  }
  if (cards.length > 0) addKpiCardRow(slide, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  if (ch.atRiskCohorts.length > 0) {
    const y = cards.length > 0 ? CONTENT_TOP + 2.25 : CONTENT_TOP;
    const h = 10.375 - y - 0.4;
    addCard(slide, MARGIN, y, CONTENT_W, h);
    addCardHeading(slide, 'Cohorts worth acting on', MARGIN + 0.42, y + 0.36, CONTENT_W - 0.84);
    ch.atRiskCohorts.forEach((c, i) => {
      const rowY = y + 1.05 + i * 1.0;
      slide.addText(c.label, {
        x: MARGIN + 0.42,
        y: rowY,
        w: CONTENT_W - 4,
        h: 0.4,
        fontFace: FONT_FAMILY,
        fontSize: TYPE.rowTitle,
        bold: true,
        color: COLORS.ink,
      });
      slide.addText(`${c.count} customers`, {
        x: MARGIN + CONTENT_W - 3.4,
        y: rowY,
        w: 3,
        h: 0.4,
        align: 'right',
        fontFace: FONT_FAMILY,
        fontSize: TYPE.rowTitle,
        bold: true,
        color: COLORS.ink,
      });
    });
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Recommendations ---------------------------------------------------------

function buildRecommendationsSlide(pptx: pptxgen, snapshot: ReportSnapshot, pageLabel: string): void {
  const slide = pptx.addSlide();
  addCanvas(slide);
  const recs = snapshot.recommendations.slice(0, 6);
  addHeader(
    slide,
    'Prioritised Recommendations',
    `${recs.length} action${recs.length === 1 ? '' : 's'}, ordered by expected impact`,
    pageLabel,
  );

  const available = 10.375 - CONTENT_TOP - 0.4;
  const gap = 0.22;
  const cardH = Math.min(1.32, (available - gap * (recs.length - 1)) / Math.max(recs.length, 1));
  recs.forEach((r, i) => {
    addRecommendationCard(slide, i + 1, r.priority, r.text, MARGIN, CONTENT_TOP + i * (cardH + gap), CONTENT_W, cardH);
  });

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Roadmap ---------------------------------------------------------------

function buildRoadmapSlide(pptx: pptxgen, snapshot: ReportSnapshot, pageLabel: string): void {
  const roadmap = snapshot.strategicRoadmap;
  if (!roadmap) return;
  const slide = pptx.addSlide();
  addCanvas(slide);
  addHeader(slide, 'Strategic Action Roadmap', "Sequenced from this report's findings", pageLabel);

  const cardH = 10.375 - CONTENT_TOP - 0.4;
  const gap = 0.32;
  const colW = (CONTENT_W - gap * (roadmap.length - 1)) / roadmap.length;
  roadmap.forEach((phase, i) => {
    const x = MARGIN + i * (colW + gap);
    addCard(slide, x, CONTENT_TOP, colW, cardH);
    slide.addShape('rect', {
      x: x + 0.42,
      y: CONTENT_TOP + 0.42,
      w: 0.5,
      h: 0.07,
      fill: { color: COLORS.brandAccent },
      line: { type: 'none' },
    });
    addEyebrow(slide, `Phase ${String(phase.phase).padStart(2, '0')}`, x + 0.42, CONTENT_TOP + 0.72, colW - 0.84, COLORS.brandAccent);
    slide.addText(phase.title, {
      x: x + 0.42,
      y: CONTENT_TOP + 1.1,
      w: colW - 0.84,
      h: 0.8,
      fontFace: FONT_FAMILY,
      fontSize: 22,
      bold: true,
      color: COLORS.ink,
    });
    slide.addText(phase.description, {
      x: x + 0.42,
      y: CONTENT_TOP + 2.0,
      w: colW - 0.84,
      h: cardH - 2.5,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.body,
      color: COLORS.gray,
      valign: 'top',
    });
  });

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Methodology -------------------------------------------------------------

function buildMethodologySlide(pptx: pptxgen, snapshot: ReportSnapshot, pageLabel: string): void {
  const slide = pptx.addSlide();
  addCanvas(slide);
  addHeader(slide, 'Methodology, Privacy & Data Sources', 'How this report was built', pageLabel);

  const m = snapshot.methodology;
  const cardH = 10.375 - CONTENT_TOP - 0.4;
  const colGap = 0.58;
  const colW = (CONTENT_W - colGap) / 2;

  addCard(slide, MARGIN, CONTENT_TOP, colW, cardH);
  addCardHeading(slide, 'Data sources', MARGIN + 0.42, CONTENT_TOP + 0.36, colW - 0.84);
  m.dataSources.forEach((source, i) => {
    const y = CONTENT_TOP + 1.0 + i * 1.15;
    slide.addText(source.name, {
      x: MARGIN + 0.42,
      y,
      w: colW - 0.84,
      h: 0.34,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.rowTitle,
      bold: true,
      color: COLORS.ink,
    });
    slide.addText(source.description, {
      x: MARGIN + 0.42,
      y: y + 0.36,
      w: colW - 0.84,
      h: 0.62,
      fontFace: FONT_FAMILY,
      fontSize: 14,
      color: COLORS.gray,
    });
  });

  const rightX = MARGIN + colW + colGap;
  addCard(slide, rightX, CONTENT_TOP, colW, cardH);
  addCardHeading(slide, 'Limitations', rightX + 0.42, CONTENT_TOP + 0.36, colW - 0.84);
  m.limitations.forEach((limitation, i) => {
    const y = CONTENT_TOP + 1.0 + i * 1.15;
    slide.addShape('rect', {
      x: rightX + 0.42,
      y: y + 0.1,
      w: 0.06,
      h: 0.5,
      fill: { color: COLORS.warningAccent },
      line: { type: 'none' },
    });
    slide.addText(limitation, {
      x: rightX + 0.75,
      y,
      w: colW - 1.2,
      h: 0.95,
      fontFace: FONT_FAMILY,
      fontSize: 14,
      color: COLORS.ink,
    });
  });

  slide.addText(
    `Report status: ${snapshot.privacy.approval.status}${snapshot.privacy.approval.reviewedBy ? ` · Reviewed by ${snapshot.privacy.approval.reviewedBy}` : ''}`,
    {
      x: rightX + 0.42,
      y: CONTENT_TOP + cardH - 0.7,
      w: colW - 0.84,
      h: 0.32,
      fontFace: FONT_FAMILY,
      fontSize: 12,
      color: COLORS.grayLight,
    },
  );

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Appendix (internal mode only) ------------------------------------------

function buildAppendixSlide(pptx: pptxgen, snapshot: ReportSnapshot, pageLabel: string): void {
  const slide = pptx.addSlide();
  addCanvas(slide);
  addHeader(slide, 'Appendix', 'Internal notes - never included in client-safe exports', pageLabel);

  const cardH = 10.375 - CONTENT_TOP - 0.4;
  addCard(slide, MARGIN, CONTENT_TOP, CONTENT_W, cardH);
  const entries = Object.entries(snapshot.appendix ?? {}).filter(([key]) => key !== 'aiSummary');
  entries.forEach(([key, value], i) => {
    slide.addText(`${key}: ${JSON.stringify(value)}`, {
      x: MARGIN + 0.42,
      y: CONTENT_TOP + 0.5 + i * 0.5,
      w: CONTENT_W - 0.84,
      h: 0.44,
      fontFace: FONT_FAMILY,
      fontSize: 12,
      color: COLORS.gray,
    });
  });

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}
