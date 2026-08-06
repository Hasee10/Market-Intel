'server-only';

import pptxgen from 'pptxgenjs';
import type { ReportSnapshot } from '../../schema';
import { buildSectionPlan, type PlannedSection, type SectionPlan, ROWS_PER_TABLE_PAGE } from '../../section-plan';
import { COLORS, FONT_FAMILY, formatCurrency, formatDate, formatMetricName, formatPercent } from '../../design-tokens';
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
  addInsightCard,
  addRecommendationCard,
  addSectionDivider,
  addConfidentialityPill,
  addNativeBarChart,
  addNativeLineChart,
  addPriceLadder,
  signalBadge,
  type KpiCardSpec,
  type BarRowSpec,
  type PriceLadderRung,
  type PillTone,
} from './components';
import { median } from '../../metrics/statistics';
import { safeRatio } from '../../metrics/growth';

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
        buildCoverSlide(pptx, snapshot, plan);
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

function buildCoverSlide(pptx: pptxgen, snapshot: ReportSnapshot, plan: SectionPlan): void {
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

  // "This cycle covers" - the included TOC entries, 2 columns. Only ever
  // lists what actually made it into the deck (plan.toc's included rows) -
  // never a fixed catalogue of sections regardless of data.
  const includedTitles = plan.toc.filter((e) => e.status === 'included').map((e) => e.title);
  if (includedTitles.length > 0) {
    slide.addText('THIS CYCLE COVERS', {
      x: MARGIN,
      y: 6.56,
      w: panelW - MARGIN * 2,
      h: 0.28,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.kpiLabel,
      bold: true,
      color: COLORS.paper,
      charSpacing: 1.5,
      transparency: 30,
    });
    const colW = (panelW - MARGIN * 2 - 0.3) / 2;
    const perCol = Math.ceil(includedTitles.length / 2);
    includedTitles.forEach((title, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      slide.addText(`•  ${title}`, {
        x: MARGIN + col * (colW + 0.3),
        y: 6.92 + row * 0.38,
        w: colW,
        h: 0.3,
        fontFace: FONT_FAMILY,
        fontSize: 14,
        color: COLORS.paper,
        transparency: 8,
      });
    });
  }

  // Headline KPI strip along the bottom of the purple panel - only the
  // metrics that actually exist, never padded to a fixed count.
  const cards: KpiCardSpec[] = [];
  const currency = snapshot.workspace.reportingCurrency;
  if (snapshot.revenue) {
    cards.push(kpiCardFromGrowth('Revenue', snapshot.revenue.revenue, (v) => formatCurrency(v, currency), true));
    cards.push(kpiCardFromGrowth('Orders', snapshot.revenue.orders, (v) => String(Math.round(v)), true));
  }
  if (snapshot.marketplacePerformance?.priceIndex) {
    cards.push({
      label: 'Price index',
      valueText: snapshot.marketplacePerformance.priceIndex.value.toFixed(0),
      deltaText: 'vs. market',
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
    addKpiCardRow(slide, pptx, cards, MARGIN, 8.9, panelW - MARGIN * 2, 1.3);
  }

  // Right strip: minimal - metadata already lives on the left panel, so
  // this side is just the confidentiality pill and a one-line generation
  // note, not a duplicate of what the purple panel already states.
  slide.addText(
    `Generated automatically from your store data and Ryvl's tracked market scan. Every figure traces to a source listed on the methodology page.`,
    {
      x: panelW + 0.67,
      y: SLIDE_H - 1.4,
      w: SLIDE_W - panelW - 1.34,
      h: 0.9,
      fontFace: FONT_FAMILY,
      fontSize: 13,
      color: COLORS.gray,
      valign: 'top',
    },
  );

  addConfidentialityPill(slide, snapshot.metadata.mode, SLIDE_W - MARGIN - 2.42, 0.67);
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
    cards.push({
      ...kpiCardFromGrowth('Revenue', snapshot.revenue.revenue, (v) => formatCurrency(v, currency)),
      sparkline: snapshot.revenue.weeklySeries?.map((p) => p.value) ?? null,
    });
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
  addKpiCardRow(slide, pptx, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  const lowerY = CONTENT_TOP + 2.25;
  const lowerH = 10.375 - lowerY - 0.4;
  const narrative = snapshot.appendix?.aiSummary as string | undefined;
  const signals = snapshot.marketSignals.slice(0, 4);

  // Insight card (purple, ~55%) on the left, "what changed" (white, ~45%)
  // on the right - matches the reference deck's proportions and priority:
  // the narrated read is the primary artifact on this slide, not a sidebar.
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
    addInsightCard(slide, 'Ryvl insight', narrative, microMetrics.slice(0, 3), MARGIN, lowerY, insightW, lowerH);
  }

  if (signals.length > 0) {
    const signalsX = narrative ? MARGIN + CONTENT_W * 0.55 + 0.42 : MARGIN;
    const signalsW = narrative ? CONTENT_W * 0.45 - 0.42 : CONTENT_W;
    addCard(slide, signalsX, lowerY, signalsW, lowerH);
    addCardHeading(slide, 'What changed this cycle', signalsX + 0.42, lowerY + 0.36, signalsW - 0.84);
    signals.forEach((signal, i) => {
      const sy = lowerY + 1.0 + i * 0.98;
      const badge = signalBadge(signal.kind);
      addPill(slide, badge.label, badge.tone, signalsX + 0.42, sy, 0.95, 0.3);
      slide.addText(signal.description, {
        x: signalsX + 0.42,
        y: sy + 0.4,
        w: signalsW - 0.84,
        h: 0.54,
        fontFace: FONT_FAMILY,
        fontSize: TYPE.body,
        color: COLORS.ink,
        valign: 'top',
      });
      if (i < signals.length - 1) {
        slide.addShape('rect', {
          x: signalsX + 0.42,
          y: sy + 0.92,
          w: signalsW - 0.84,
          h: 0.012,
          fill: { color: COLORS.hairlineSoft },
          line: { type: 'none' },
        });
      }
    });
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
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
  const percentile = snapshot.pricePositioning?.percentile ?? null;
  if (percentile != null) {
    cards.push({
      label: 'Your percentile',
      valueText: `${percentile}${ordinalSuffix(percentile)}`,
      deltaText: 'Of the tracked price range',
    });
  }
  cards.push({ label: 'Platforms in scope', valueText: String(mp.scope.platformNames.length) });
  addKpiCardRow(slide, pptx, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  const chartY = CONTENT_TOP + 2.25;
  const chartH = 10.375 - chartY - 0.4;
  addCard(slide, MARGIN, chartY, CONTENT_W, chartH);
  addCardHeading(slide, 'Where your price sits in the tracked market', MARGIN + 0.42, chartY + 0.36, CONTENT_W - 0.84);

  if (percentile != null) {
    addNativeBarChart(
      slide,
      pptx,
      ['25th pct', 'You', '75th pct'],
      [25, percentile, 75],
      MARGIN + 0.42,
      chartY + 1.0,
      CONTENT_W - 0.84,
      chartH - 1.9,
    );
    // Deterministic "read" line - plain arithmetic on the percentile
    // already shown above, never an LLM restating (or misstating) it.
    const read =
      percentile >= 75
        ? 'You price above three quarters of the tracked set.'
        : percentile >= 50
          ? 'You price above the market median, inside the upper half of the tracked set.'
          : percentile >= 25
            ? 'You price below the market median, inside the lower half of the tracked set.'
            : 'You price below three quarters of the tracked set.';
    slide.addText(read, {
      x: MARGIN + 0.42,
      y: chartY + chartH - 0.7,
      w: CONTENT_W - 0.84,
      h: 0.4,
      fontFace: FONT_FAMILY,
      fontSize: 14,
      italic: true,
      color: COLORS.gray,
    });
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
  const gapPct = safeRatio(pp.yourMedianPrice.value - pp.marketMedian.value, pp.marketMedian.value);
  const cards: KpiCardSpec[] = [
    { label: 'Your price', valueText: formatCurrency(pp.yourMedianPrice.value, currency) },
    { label: 'Market median', valueText: formatCurrency(pp.marketMedian.value, currency) },
  ];
  if (gapPct != null) {
    const pct = gapPct * 100;
    cards.push({
      label: 'Gap',
      valueText: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
      deltaText: pct >= 0 ? 'Above market median' : 'Below market median',
      deltaDirection: pct >= 0 ? 'up' : 'down',
    });
  }
  addKpiCardRow(slide, pptx, cards, MARGIN, CONTENT_TOP, CONTENT_W);

  const lowerY = CONTENT_TOP + 2.25;
  const lowerH = 10.375 - lowerY - 0.4;
  const hasTrend = pp.trend != null && pp.trend.length >= 2;
  const ladderW = hasTrend ? CONTENT_W * 0.36 - 0.42 : CONTENT_W;
  const ladderX = hasTrend ? MARGIN + CONTENT_W * 0.64 + 0.42 : MARGIN;

  if (hasTrend) {
    addCard(slide, MARGIN, lowerY, CONTENT_W * 0.64, lowerH);
    addCardHeading(slide, 'Market median price over time', MARGIN + 0.42, lowerY + 0.36, CONTENT_W * 0.64 - 0.84);
    addNativeLineChart(
      slide,
      pptx,
      pp.trend!.map((t) => formatDate(t.date)),
      [{ name: 'Market median', values: pp.trend!.map((t) => t.medianPrice) }],
      MARGIN + 0.42,
      lowerY + 1.0,
      CONTENT_W * 0.64 - 0.84,
      lowerH - 1.5,
    );
  }

  // Price ladder - the reference deck's signature visual for this section.
  // Rungs are only what PricePositioningSection actually carries (your
  // price, market median, recommended band low/high) - no invented
  // "lowest/highest tracked" value, since that isn't in the schema.
  const ladderCardH = pp.recommendedBand ? lowerH - 1.85 : lowerH;
  addCard(slide, ladderX, lowerY, ladderW, ladderCardH);
  addCardHeading(slide, 'Price ladder', ladderX + 0.42, lowerY + 0.36, ladderW - 0.84);

  const rungs: PriceLadderRung[] = [
    { label: 'Your price', valueText: formatCurrency(pp.yourMedianPrice.value, currency), value: pp.yourMedianPrice.value, color: COLORS.negative, emphasized: true },
  ];
  if (pp.recommendedBand) {
    rungs.push({ label: 'Band - high', valueText: formatCurrency(pp.recommendedBand.high, currency), value: pp.recommendedBand.high, color: COLORS.brandAccent });
  }
  rungs.push({ label: 'Market median', valueText: formatCurrency(pp.marketMedian.value, currency), value: pp.marketMedian.value, color: COLORS.grayLight });
  if (pp.recommendedBand) {
    rungs.push({ label: 'Band - low', valueText: formatCurrency(pp.recommendedBand.low, currency), value: pp.recommendedBand.low, color: COLORS.info });
  }
  addPriceLadder(slide, rungs, ladderX + 0.42, lowerY + 1.0, ladderW - 0.84);

  if (pp.recommendedBand) {
    const bandY = lowerY + ladderCardH + 0.24;
    const bandH = lowerH - ladderCardH - 0.24;
    const inside = pp.yourMedianPrice.value >= pp.recommendedBand.low && pp.yourMedianPrice.value <= pp.recommendedBand.high;
    slide.addShape('roundRect', { x: ladderX, y: bandY, w: ladderW, h: bandH, rectRadius: 0.02, fill: { color: COLORS.brand }, line: { type: 'none' } });
    slide.addText('RECOMMENDED BAND', {
      x: ladderX + 0.32,
      y: bandY + 0.2,
      w: ladderW - 0.64,
      h: 0.26,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.kpiLabel,
      bold: true,
      color: COLORS.paper,
      charSpacing: 1.2,
      transparency: 15,
    });
    slide.addText(`${formatCurrency(pp.recommendedBand.low, currency)} – ${formatCurrency(pp.recommendedBand.high, currency)}`, {
      x: ladderX + 0.32,
      y: bandY + 0.5,
      w: ladderW - 0.64,
      h: 0.44,
      fontFace: FONT_FAMILY,
      fontSize: 22,
      bold: true,
      color: COLORS.paper,
    });
    slide.addText(
      inside ? 'You are inside the recommended band.' : `You are outside the recommended band, on the ${pp.yourMedianPrice.value > pp.recommendedBand.high ? 'high' : 'low'} side.`,
      {
        x: ladderX + 0.32,
        y: bandY + bandH - 0.42,
        w: ladderW - 0.64,
        h: 0.32,
        fontFace: FONT_FAMILY,
        fontSize: 13,
        color: COLORS.paper,
        transparency: 10,
      },
    );
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

  // Highlight cards only on the first page - they describe the whole
  // tracked set, not this page's slice, so repeating them on continuation
  // pages would be redundant rather than informative.
  const showHighlights = section.page === 0;
  const tableW = showHighlights ? CONTENT_W * 0.68 - 0.42 : CONTENT_W;
  addCard(slide, MARGIN, CONTENT_TOP, tableW, cardH);

  const colWidths = [tableW * 0.28, tableW * 0.16, tableW * 0.12, tableW * 0.19, tableW * 0.12, tableW * 0.13];
  addDataRows(
    slide,
    ['Competitor', 'Platform', 'SKUs', 'Median price', 'In stock', 'Repricing'],
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
    tableW - 0.84,
    0.86,
  );

  if (section.truncated) {
    slide.addText(
      `+${section.truncatedCount} more tracked competitors — the full list stays live in your Ryvl dashboard.`,
      {
        x: MARGIN + 0.42,
        y: CONTENT_TOP + 1.12 + ROWS_PER_TABLE_PAGE * 0.86,
        w: tableW - 0.84,
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
    w: tableW - 0.84,
    h: 0.3,
    fontFace: FONT_FAMILY,
    fontSize: 12,
    color: COLORS.grayLight,
  });

  if (showHighlights) {
    const hx = MARGIN + tableW + 0.42;
    const hw = CONTENT_W - tableW - 0.42;
    let hy = CONTENT_TOP;

    // Most active repricer - highest repricingRate among rows that have one.
    const withRepricing = cb.scorecards.filter((r) => r.repricingRate != null);
    if (withRepricing.length > 0) {
      const top = withRepricing.reduce((a, b) => (b.repricingRate! > a.repricingRate! ? b : a));
      const h1 = 1.9;
      addHighlightCard(
        slide,
        'MOST ACTIVE REPRICER',
        top.competitorName,
        `Repriced ${formatPercent(top.repricingRate! * 100, 0)} of tracked SKUs this period.`,
        COLORS.warningBg,
        hx,
        hy,
        hw,
        h1,
      );
      hy += h1 + 0.24;
    }

    // Supply void - lowest in-stock rate among rows with a real sample
    // (skuCount >= 5), matching rules/market-signals.ts's own threshold for
    // the same signal so this card and the "what changed" list never disagree.
    const eligible = cb.scorecards.filter((r) => r.skuCount >= 5);
    if (eligible.length > 0) {
      const worst = eligible.reduce((a, b) => (b.inStockRate < a.inStockRate ? b : a));
      const h2 = 1.9;
      addHighlightCard(
        slide,
        'SUPPLY VOID',
        worst.competitorName,
        `Out of stock on ${formatPercent((1 - worst.inStockRate) * 100, 0)} of their tracked assortment.`,
        COLORS.positiveBg,
        hx,
        hy,
        hw,
        h2,
      );
      hy += h2 + 0.24;
    }

    // Tracked-set medians - median() over the whole set, not just this page.
    const medPrice = median(cb.scorecards.map((r) => r.medianPrice.value));
    const medStock = median(cb.scorecards.map((r) => r.inStockRate));
    const medReprice = median(withRepricing.map((r) => r.repricingRate!));
    const h3 = CONTENT_TOP + cardH - hy;
    if (h3 > 1 && (medPrice != null || medStock != null || medReprice != null)) {
      addCard(slide, hx, hy, hw, h3);
      addCardHeading(slide, 'Tracked-set medians', hx + 0.36, hy + 0.3, hw - 0.72);
      const statRows: [string, string | null][] = [
        ['Median price', medPrice != null ? formatCurrency(medPrice, currency) : null],
        ['Median in-stock', medStock != null ? formatPercent(medStock * 100, 0) : null],
        ['Median repricing', medReprice != null ? formatPercent(medReprice * 100, 0) : null],
      ];
      let sy = hy + 0.8;
      for (const [label, value] of statRows) {
        if (value == null) continue;
        slide.addText(label, { x: hx + 0.36, y: sy, w: hw - 1.7, h: 0.3, fontFace: FONT_FAMILY, fontSize: TYPE.rowSubtitle, color: COLORS.gray });
        slide.addText(value, { x: hx + hw - 1.7, y: sy, w: 1.35, h: 0.3, align: 'right', fontFace: FONT_FAMILY, fontSize: TYPE.rowSubtitle, bold: true, color: COLORS.ink });
        sy += 0.4;
      }
    }
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

function addHighlightCard(
  slide: pptxgen.Slide,
  eyebrow: string,
  title: string,
  body: string,
  bg: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.02, fill: { color: bg }, line: { type: 'none' } });
  addEyebrow(slide, eyebrow, x + 0.36, y + 0.26, w - 0.72, COLORS.ink);
  slide.addText(title, {
    x: x + 0.36,
    y: y + 0.56,
    w: w - 0.72,
    h: 0.4,
    fontFace: FONT_FAMILY,
    fontSize: 18,
    bold: true,
    color: COLORS.ink,
  });
  slide.addText(body, {
    x: x + 0.36,
    y: y + 0.98,
    w: w - 0.72,
    h: h - 1.15,
    fontFace: FONT_FAMILY,
    fontSize: 13,
    color: COLORS.gray,
    valign: 'top',
  });
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
    // Real days-of-cover drives a CRITICAL/WATCH severity split when the
    // data exists; falls back to the generic "Below threshold" pill when
    // it doesn't (which is always, today - no sell-through-rate data
    // source exists yet, see collectors/revenue-and-products.ts - this
    // branch is forward-compatible code, not a currently-visible change).
    if (sku.daysOfCoverEstimate != null) {
      const critical = sku.daysOfCoverEstimate < 7;
      addPill(slide, `${Math.round(sku.daysOfCoverEstimate)}d cover left`, critical ? 'negative' : 'warning', MARGIN + leftW - 2.1, y + 0.06, 1.68);
    } else {
      addPill(slide, 'Below threshold', 'warning', MARGIN + leftW - 2.1, y + 0.06, 1.68);
    }
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
    const voids = ir.supplyVoidOpportunities!.slice(0, 4);

    // Genuine category-overlap check against the seller's own catalogue,
    // not an unverified "you can absorb this" claim - a void only gets the
    // overlap tag when its category name actually matches one the seller
    // carries (case-insensitive). No overlap data -> no tag, not a guess.
    const sellerCategories = new Set((snapshot.productPerformance?.categoryBreakdown ?? []).map((c) => c.category.toLowerCase()));
    const overlapping = voids.filter((op) => op.category && sellerCategories.has(op.category.toLowerCase()));

    const voidsCardH = 1.0 + voids.length * 0.78;
    addCard(slide, rightX, CONTENT_TOP, rightW, voidsCardH);
    addCardHeading(slide, 'Supply void opportunities', rightX + 0.42, CONTENT_TOP + 0.36, rightW - 0.84);
    voids.forEach((op, i) => {
      const y = CONTENT_TOP + 1.0 + i * 0.78;
      const isOverlap = op.category && sellerCategories.has(op.category.toLowerCase());
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
      addPill(slide, isOverlap ? 'In your catalogue' : 'Out of stock', 'positive', rightX + rightW - 2.1, y + 0.06, 1.68);
    });

    // Net position - a template sentence built from real counts (overlap
    // count vs. total at-risk count), not an AI narrative.
    const netY = CONTENT_TOP + voidsCardH + 0.24;
    const netH = cardH - voidsCardH - 0.24;
    if (netH > 1) {
      slide.addShape('roundRect', { x: rightX, y: netY, w: rightW, h: netH, rectRadius: 0.02, fill: { color: COLORS.brand }, line: { type: 'none' } });
      slide.addText('NET POSITION', {
        x: rightX + 0.36,
        y: netY + 0.28,
        w: rightW - 0.72,
        h: 0.26,
        fontFace: FONT_FAMILY,
        fontSize: TYPE.kpiLabel,
        bold: true,
        color: COLORS.paper,
        charSpacing: 1.2,
        transparency: 15,
      });
      const netText =
        overlapping.length > 0
          ? `${overlapping.length} of your ${ir.lowStockSkuCount} at-risk SKU${ir.lowStockSkuCount === 1 ? '' : 's'} sit in categories where a tracked competitor is currently out of stock — reordering there covers your own risk and captures their gap.`
          : `None of the ${voids.length} tracked supply voids overlap your own catalogue categories this cycle.`;
      slide.addText(netText, {
        x: rightX + 0.36,
        y: netY + 0.6,
        w: rightW - 0.72,
        h: netH - 0.8,
        fontFace: FONT_FAMILY,
        fontSize: 13,
        color: COLORS.paper,
        valign: 'top',
      });
    }
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

  const totalH = 10.375 - CONTENT_TOP - 0.4;
  const sorted = [...pp.categoryBreakdown].sort((a, b) => b.share - a.share);
  // Top-2 concentration - real arithmetic on data already in the snapshot,
  // never a fabricated "your portfolio is concentrated" claim.
  const topTwoShare = sorted.slice(0, 2).reduce((sum, c) => sum + c.share, 0);
  const hasConcentration = sorted.length >= 2;
  const concentrationH = hasConcentration ? 1.6 : 0;
  const barsH = totalH - (hasConcentration ? concentrationH + 0.24 : 0);

  addCard(slide, MARGIN, CONTENT_TOP, CONTENT_W, barsH);
  addCardHeading(slide, 'Category share', MARGIN + 0.42, CONTENT_TOP + 0.36, CONTENT_W - 0.84);

  const shown = sorted.slice(0, 5);
  const maxShare = Math.max(...shown.map((c) => c.share), 0.0001);
  addBarRows(
    slide,
    shown.map((c) => ({
      title: c.category,
      valueText: formatPercent(c.share * 100, 1),
      ratio: c.share / maxShare,
    })),
    MARGIN + 0.42,
    CONTENT_TOP + 1.05,
    CONTENT_W - 0.84,
    1.06,
  );

  if (hasConcentration) {
    addInsightPanel(
      slide,
      'Concentration',
      `Your top two categories, ${sorted[0].category} and ${sorted[1].category}, hold ${formatPercent(topTwoShare * 100, 1)} of ${pp.contributionBasis === 'revenue' ? 'revenue' : 'inventory value'} between them.`,
      MARGIN,
      CONTENT_TOP + barsH + 0.24,
      CONTENT_W,
      concentrationH,
    );
  }

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
  if (cards.length > 0) addKpiCardRow(slide, pptx, cards, MARGIN, CONTENT_TOP, CONTENT_W);

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

  // 2-column grid, matching the reference deck - a stacked single column
  // reads as a plain list; two columns of taller cards give each
  // recommendation room for its own timeframe label without crowding.
  const available = 10.375 - CONTENT_TOP - 0.4;
  const colGap = 0.32;
  const rowGap = 0.32;
  const cols = recs.length > 1 ? 2 : 1;
  const rows = Math.ceil(recs.length / cols);
  const cardW = (CONTENT_W - colGap * (cols - 1)) / cols;
  const cardH = Math.min(2.15, (available - rowGap * (rows - 1)) / Math.max(rows, 1));
  recs.forEach((r, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const timeframe = r.priority === 'high' ? 'Act this week' : 'Next 30 days';
    addRecommendationCard(
      slide,
      i + 1,
      r.priority,
      r.text,
      timeframe,
      MARGIN + col * (cardW + colGap),
      CONTENT_TOP + row * (cardH + rowGap),
      cardW,
      cardH,
    );
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
  const colGap = 0.42;
  const colW = (CONTENT_W - colGap * 2) / 3;

  addCard(slide, MARGIN, CONTENT_TOP, colW, cardH);
  addCardHeading(slide, 'Data sources', MARGIN + 0.36, CONTENT_TOP + 0.32, colW - 0.72);
  m.dataSources.forEach((source, i) => {
    const y = CONTENT_TOP + 1.0 + i * 1.15;
    slide.addText(source.name, {
      x: MARGIN + 0.36,
      y,
      w: colW - 0.72,
      h: 0.34,
      fontFace: FONT_FAMILY,
      fontSize: TYPE.rowTitle,
      bold: true,
      color: COLORS.ink,
    });
    slide.addText(source.description, {
      x: MARGIN + 0.36,
      y: y + 0.36,
      w: colW - 0.72,
      h: 0.62,
      fontFace: FONT_FAMILY,
      fontSize: 14,
      color: COLORS.gray,
    });
  });

  const midX = MARGIN + colW + colGap;
  addCard(slide, midX, CONTENT_TOP, colW, cardH);
  addCardHeading(slide, 'Limitations', midX + 0.36, CONTENT_TOP + 0.32, colW - 0.72);
  m.limitations.forEach((limitation, i) => {
    const y = CONTENT_TOP + 1.0 + i * 1.15;
    slide.addShape('rect', {
      x: midX + 0.36,
      y: y + 0.1,
      w: 0.06,
      h: 0.5,
      fill: { color: COLORS.warningAccent },
      line: { type: 'none' },
    });
    slide.addText(limitation, {
      x: midX + 0.68,
      y,
      w: colW - 1.04,
      h: 0.95,
      fontFace: FONT_FAMILY,
      fontSize: 14,
      color: COLORS.ink,
    });
  });

  const rightX = MARGIN + (colW + colGap) * 2;
  addCard(slide, rightX, CONTENT_TOP, colW, cardH);
  addCardHeading(slide, 'Report status', rightX + 0.36, CONTENT_TOP + 0.32, colW - 0.72);
  const statusTone: PillTone =
    snapshot.privacy.approval.status === 'approved'
      ? 'positive'
      : snapshot.privacy.approval.status === 'rejected'
        ? 'negative'
        : 'neutral';
  addPill(slide, formatMetricName(snapshot.privacy.approval.status), statusTone, rightX + 0.36, CONTENT_TOP + 0.9, 1.6, 0.4);
  slide.addText(
    snapshot.privacy.approval.reviewedBy ? `Reviewed by ${snapshot.privacy.approval.reviewedBy}.` : 'Not yet reviewed.',
    {
      x: rightX + 0.36,
      y: CONTENT_TOP + 1.5,
      w: colW - 0.72,
      h: 0.4,
      fontFace: FONT_FAMILY,
      fontSize: 14,
      color: COLORS.ink,
    },
  );
  slide.addShape('rect', { x: rightX + 0.36, y: CONTENT_TOP + 2.15, w: colW - 0.72, h: 0.012, fill: { color: COLORS.hairline }, line: { type: 'none' } });
  slide.addText(
    `Report ref ${snapshot.metadata.reportId.slice(0, 8).toUpperCase()} · generated ${formatDate(snapshot.metadata.generatedAt)} for ${snapshot.metadata.period.label.toLowerCase()}.`,
    {
      x: rightX + 0.36,
      y: CONTENT_TOP + 2.4,
      w: colW - 0.72,
      h: 0.6,
      fontFace: FONT_FAMILY,
      fontSize: 13,
      color: COLORS.gray,
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
