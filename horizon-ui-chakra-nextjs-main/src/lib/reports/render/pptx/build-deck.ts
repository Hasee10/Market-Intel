'server-only';

import pptxgen from 'pptxgenjs';
import type { ReportSnapshot } from '../../schema';
import { buildSectionPlan, type PlannedSection, ROWS_PER_TABLE_PAGE } from '../../section-plan';
import { formatCurrency, formatDate, formatPercent } from '../../design-tokens';
import {
  addBackground,
  addHeader,
  addFooter,
  addKpiCardRow,
  kpiCardFromGrowth,
  addNativeTable,
  addBarChart,
  addLineChart,
  addInsightCallout,
  addRecommendationCard,
  addSectionDivider,
  addConfidentialityLabel,
  MARGIN,
  CONTENT_W,
  SLIDE_W,
  SLIDE_H,
} from './components';

// Generates the entire deck from scratch, in code, every time - no base
// .pptx template file is loaded or modified. This is the direct fix for
// two problems found in the previous system: (1) a fixed 11-slide template
// that always emitted every slide regardless of data (docs/reports-v2-
// architecture.md §5's "dynamic slide count" section), and (2) fragile
// coupling to Google-Slides-auto-generated shape names. Every element here
// is a native OOXML object (text/table/chart/shape) via pptxgenjs -
// genuinely editable in PowerPoint, nothing flattened to an image.
export async function buildReportDeck(snapshot: ReportSnapshot): Promise<Buffer> {
  const plan = buildSectionPlan(snapshot);
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'RYVL_WIDE', width: SLIDE_W, height: SLIDE_H });
  pptx.layout = 'RYVL_WIDE';
  pptx.author = 'Ryvl';
  pptx.company = 'Ryvl';
  pptx.title = `${snapshot.workspace.businessName} - ${snapshot.metadata.period.label}`;

  // One running index across the whole deck (not per-section) - the "Slide
  // N" label in every header comes from here, so it always matches the
  // deck's actual, data-driven length instead of a number baked in per slide.
  let slideIndex = 0;
  const label = (section: PlannedSection) => {
    slideIndex += 1;
    return pageLabel(section, slideIndex);
  };

  for (const section of plan.sections) {
    switch (section.kind) {
      case 'cover':
        slideIndex += 1;
        buildCoverSlide(pptx, snapshot);
        break;
      case 'executive_snapshot':
        buildExecutiveSnapshotSlide(pptx, snapshot, section, label(section));
        break;
      case 'market_position':
        buildMarketPositionSlide(pptx, snapshot, section, label(section));
        break;
      case 'pricing_intelligence':
        buildPricingIntelligenceSlide(pptx, snapshot, section, label(section));
        break;
      case 'competitor_tracking':
        buildCompetitorTrackingSlide(pptx, snapshot, section, label(section));
        break;
      case 'sku_performance':
        buildSkuPerformanceSlide(pptx, snapshot, section, label(section));
        break;
      case 'inventory_risk':
        buildInventoryRiskSlide(pptx, snapshot, section, label(section));
        break;
      case 'portfolio_contribution':
        buildPortfolioSlide(pptx, snapshot, section, label(section));
        break;
      case 'customer_health':
        buildCustomerHealthSlide(pptx, snapshot, section, label(section));
        break;
      case 'recommendations':
        buildRecommendationsSlide(pptx, snapshot, section, label(section));
        break;
      case 'roadmap':
        buildRoadmapSlide(pptx, snapshot, section, label(section));
        break;
      case 'methodology':
        buildMethodologySlide(pptx, snapshot, section, label(section));
        break;
      case 'appendix':
        buildAppendixSlide(pptx, snapshot, section, label(section));
        break;
    }
  }

  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return buffer;
}

function sourceLine(snapshot: ReportSnapshot): string {
  return `Source: ${snapshot.methodology.dataSources.map((s) => s.name).join(' · ')} · Generated ${formatDate(snapshot.metadata.generatedAt)}`;
}

function pageLabel(section: PlannedSection, totalIndex: number): string {
  return section.pageCount > 1 ? `Slide ${totalIndex} · ${section.page + 1}/${section.pageCount}` : `Slide ${totalIndex}`;
}

// -- Cover -------------------------------------------------------------

function buildCoverSlide(pptx: pptxgen, snapshot: ReportSnapshot): void {
  const slide = pptx.addSlide();
  addBackground(slide, '0B1437');
  slide.addText('Ryvl', {
    x: MARGIN,
    y: 0.5,
    w: 3,
    h: 0.4,
    fontFace: 'Inter',
    fontSize: 16,
    bold: true,
    color: '4318FF',
  });
  slide.addText(`Ref: ${snapshot.metadata.reportId.slice(0, 8).toUpperCase()}`, {
    x: SLIDE_W - MARGIN - 3,
    y: 0.5,
    w: 3,
    h: 0.4,
    align: 'right',
    fontFace: 'Inter',
    fontSize: 10,
    color: 'A3AED0',
  });
  slide.addText(`${snapshot.workspace.businessName}`, {
    x: MARGIN,
    y: 2.6,
    w: CONTENT_W,
    h: 1.4,
    fontFace: 'Inter',
    fontSize: 40,
    bold: true,
    color: 'FFFFFF',
  });
  slide.addText(
    snapshot.workspace.categories.length > 0
      ? `Market intelligence for ${snapshot.workspace.categories.map((c) => c.name).join(', ')}`
      : 'Seller market intelligence report',
    {
      x: MARGIN,
      y: 3.85,
      w: CONTENT_W,
      h: 0.5,
      fontFace: 'Inter',
      fontSize: 15,
      color: 'A3AED0',
    },
  );
  slide.addText(`Period: ${snapshot.metadata.period.label}  ·  Generated ${formatDate(snapshot.metadata.generatedAt)}`, {
    x: MARGIN,
    y: SLIDE_H - 1.1,
    w: CONTENT_W,
    h: 0.4,
    fontFace: 'Inter',
    fontSize: 11,
    color: '667085',
  });
  addConfidentialityLabel(slide, snapshot.metadata.mode);
}

// -- Executive snapshot --------------------------------------------------

function buildExecutiveSnapshotSlide(pptx: pptxgen, snapshot: ReportSnapshot, section: PlannedSection, label: string): void {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 'Executive Snapshot & Key Signals', snapshot.metadata.period.label, label);

  const cards = [];
  const currency = snapshot.workspace.reportingCurrency;
  if (snapshot.revenue) {
    cards.push(kpiCardFromGrowth('Revenue', snapshot.revenue.revenue, (v) => formatCurrency(v, currency)));
    cards.push(kpiCardFromGrowth('Orders', snapshot.revenue.orders, (v) => String(Math.round(v))));
  }
  if (snapshot.marketplacePerformance?.priceIndex) {
    cards.push({
      label: 'Price Index',
      valueText: snapshot.marketplacePerformance.priceIndex.value.toFixed(0),
      deltaText: '100 = at market median',
    });
  }
  if (snapshot.inventoryRisk) {
    cards.push({
      label: 'Stockout Risk SKUs',
      valueText: String(snapshot.inventoryRisk.lowStockSkuCount),
      deltaText: 'Below low-stock threshold',
    });
  }

  addKpiCardRow(slide, cards, MARGIN, 1.85, CONTENT_W, 1.15);

  const narrative = (snapshot.appendix?.aiSummary as string | undefined) ?? null;
  const calloutY = 3.25;
  if (narrative) {
    addInsightCallout(slide, narrative, MARGIN, calloutY, CONTENT_W, 0.9);
  }

  const signalsY = narrative ? calloutY + 1.05 : calloutY;
  const topSignals = snapshot.marketSignals.slice(0, 3);
  if (topSignals.length > 0) {
    slide.addText('WHAT CHANGED THIS CYCLE', {
      x: MARGIN,
      y: signalsY,
      w: CONTENT_W,
      h: 0.3,
      fontFace: 'Inter',
      fontSize: 10,
      bold: true,
      color: '667085',
      charSpacing: 1,
    });
    topSignals.forEach((signal, i) => {
      slide.addText(`•  ${signal.description}`, {
        x: MARGIN,
        y: signalsY + 0.32 + i * 0.34,
        w: CONTENT_W,
        h: 0.32,
        fontFace: 'Inter',
        fontSize: 11,
        color: '1B2559',
      });
    });
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Market position -----------------------------------------------------

function buildMarketPositionSlide(pptx: pptxgen, snapshot: ReportSnapshot, section: PlannedSection, label: string): void {
  const mp = snapshot.marketplacePerformance;
  if (!mp) return;
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(
    slide,
    'Market Position & Benchmark Percentiles',
    `Scope: ${mp.scope.platformNames.join(', ') || 'tracked marketplaces'}`,
    label,
  );

  if (mp.priceIndex) {
    addKpiCardRow(
      slide,
      [{ label: 'Price Index vs. Market', valueText: mp.priceIndex.value.toFixed(0), deltaText: '100 = at market median' }],
      MARGIN,
      1.85,
      3.2,
      1.15,
    );
  }

  if (snapshot.pricePositioning?.percentile != null) {
    addBarChart(
      slide,
      pptx,
      ['P25', 'Your position', 'P75'],
      [25, snapshot.pricePositioning.percentile, 75],
      MARGIN,
      3.2,
      CONTENT_W,
      3.4,
    );
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Pricing intelligence -------------------------------------------------

function buildPricingIntelligenceSlide(pptx: pptxgen, snapshot: ReportSnapshot, section: PlannedSection, label: string): void {
  const pp = snapshot.pricePositioning;
  if (!pp) return;
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 'Pricing Intelligence', 'Your price vs. the tracked market', label);

  const currency = snapshot.workspace.reportingCurrency;
  const cards = [
    { label: 'Your Current Price', valueText: formatCurrency(pp.yourMedianPrice.value, currency) },
    { label: 'Market Median', valueText: formatCurrency(pp.marketMedian.value, currency) },
  ];
  if (pp.recommendedBand) {
    cards.push({
      label: 'Recommended Band',
      valueText: `${formatCurrency(pp.recommendedBand.low, currency)} – ${formatCurrency(pp.recommendedBand.high, currency)}`,
    });
  }
  addKpiCardRow(slide, cards, MARGIN, 1.85, CONTENT_W, 1.15);

  if (pp.trend && pp.trend.length >= 2) {
    addLineChart(
      slide,
      pptx,
      pp.trend.map((t) => formatDate(t.date)),
      [{ name: 'Market Median Price', values: pp.trend.map((t) => t.medianPrice) }],
      MARGIN,
      3.25,
      CONTENT_W,
      3.35,
    );
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Competitor tracking (paginated) --------------------------------------

function buildCompetitorTrackingSlide(pptx: pptxgen, snapshot: ReportSnapshot, section: PlannedSection, label: string): void {
  const cb = snapshot.competitorBenchmarks;
  if (!cb || !section.rowRange) return;
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, section.title, cb.marketDefinitionSummary, label);

  const currency = snapshot.workspace.reportingCurrency;
  const rows = cb.scorecards.slice(section.rowRange[0], section.rowRange[1]);
  addNativeTable(
    slide,
    ['Competitor', 'Platform', 'SKUs', 'Median Price', 'In Stock', 'Repricing Rate'],
    rows.map((r) => [
      r.competitorName,
      r.platformName,
      r.skuCount,
      formatCurrency(r.medianPrice.value, currency),
      formatPercent(r.inStockRate * 100, 0),
      r.repricingRate != null ? formatPercent(r.repricingRate * 100, 0) : 'N/A',
    ]),
    MARGIN,
    1.85,
    CONTENT_W,
  );

  if (section.truncated) {
    slide.addText(`+${section.truncatedCount} more tracked competitors - see your Ryvl dashboard for the full list.`, {
      x: MARGIN,
      y: 1.85 + (ROWS_PER_TABLE_PAGE + 1) * 0.42,
      w: CONTENT_W,
      h: 0.3,
      fontFace: 'Inter',
      fontSize: 10,
      italic: true,
      color: '667085',
    });
  }

  slide.addText('Public marketplace signals only. Private seller data remains strictly confidential.', {
    x: MARGIN,
    y: SLIDE_H - 0.7,
    w: CONTENT_W,
    h: 0.25,
    fontFace: 'Inter',
    fontSize: 8,
    color: '667085',
  });
  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- SKU performance (paginated) ------------------------------------------

function buildSkuPerformanceSlide(pptx: pptxgen, snapshot: ReportSnapshot, section: PlannedSection, label: string): void {
  const pp = snapshot.productPerformance;
  if (!pp || !section.rowRange) return;
  const slide = pptx.addSlide();
  addBackground(slide);
  const basisLabel = pp.contributionBasis === 'revenue' ? 'by revenue' : 'by inventory value';
  addHeader(slide, section.title, `Top products ${basisLabel}`, label);

  const rows = pp.topProducts.slice(section.rowRange[0], section.rowRange[1]);
  addNativeTable(
    slide,
    ['Product', 'SKU', pp.contributionBasis === 'revenue' ? 'Revenue Share' : 'Inventory Value Share'],
    rows.map((r) => [r.title, r.sku ?? '—', r.contributionShare != null ? formatPercent(r.contributionShare * 100, 1) : 'N/A']),
    MARGIN,
    1.85,
    CONTENT_W,
  );

  if (section.truncated) {
    slide.addText(`+${section.truncatedCount} more products - see your Ryvl dashboard for the full list.`, {
      x: MARGIN,
      y: 1.85 + (ROWS_PER_TABLE_PAGE + 1) * 0.42,
      w: CONTENT_W,
      h: 0.3,
      fontFace: 'Inter',
      fontSize: 10,
      italic: true,
      color: '667085',
    });
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Inventory risk ---------------------------------------------------------

function buildInventoryRiskSlide(pptx: pptxgen, snapshot: ReportSnapshot, section: PlannedSection, label: string): void {
  const ir = snapshot.inventoryRisk;
  if (!ir) return;
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 'Inventory & Demand Risk', `${ir.lowStockSkuCount} SKUs below your low-stock threshold`, label);

  addNativeTable(
    slide,
    ['Product', 'SKU'],
    ir.stockoutRiskSkus.map((s) => [s.title, s.sku ?? '—']),
    MARGIN,
    1.85,
    CONTENT_W * 0.55,
  );

  if (ir.supplyVoidOpportunities && ir.supplyVoidOpportunities.length > 0) {
    slide.addText('SUPPLY VOID OPPORTUNITIES', {
      x: MARGIN + CONTENT_W * 0.6,
      y: 1.85,
      w: CONTENT_W * 0.4,
      h: 0.3,
      fontFace: 'Inter',
      fontSize: 10,
      bold: true,
      color: '667085',
      charSpacing: 1,
    });
    ir.supplyVoidOpportunities.slice(0, 4).forEach((op, i) => {
      slide.addText(`${op.competitorName} (${op.platformName}) is out of stock`, {
        x: MARGIN + CONTENT_W * 0.6,
        y: 2.25 + i * 0.4,
        w: CONTENT_W * 0.4,
        h: 0.36,
        fontFace: 'Inter',
        fontSize: 10,
        color: '1B2559',
      });
    });
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Portfolio contribution ---------------------------------------------------

function buildPortfolioSlide(pptx: pptxgen, snapshot: ReportSnapshot, section: PlannedSection, label: string): void {
  const pp = snapshot.productPerformance;
  if (!pp) return;
  const slide = pptx.addSlide();
  addBackground(slide);
  const basisLabel = pp.contributionBasis === 'revenue' ? 'by revenue' : 'by inventory value (no per-sale line items tracked yet)';
  addHeader(slide, 'Product Portfolio Contribution', `Category share ${basisLabel}`, label);

  addBarChart(
    slide,
    pptx,
    pp.categoryBreakdown.map((c) => c.category),
    pp.categoryBreakdown.map((c) => Math.round(c.share * 1000) / 10),
    MARGIN,
    1.85,
    CONTENT_W,
    4.3,
  );

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Customer health -------------------------------------------------------

function buildCustomerHealthSlide(pptx: pptxgen, snapshot: ReportSnapshot, section: PlannedSection, label: string): void {
  const ch = snapshot.customerHealth;
  if (!ch) return;
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 'Customer Health & Retention', 'Based on your own order and customer history', label);

  const cards = [];
  if (ch.retentionRate) {
    cards.push({ label: 'Retention Rate', valueText: formatPercent(ch.retentionRate.current, 1) });
  }
  if (ch.repeatPurchaseRate != null) {
    cards.push({ label: 'Repeat Purchase Rate', valueText: formatPercent(ch.repeatPurchaseRate, 1) });
  }
  if (ch.avgClv) {
    cards.push({ label: 'Avg. Customer LTV', valueText: formatCurrency(ch.avgClv.value, snapshot.workspace.reportingCurrency) });
  }
  addKpiCardRow(slide, cards, MARGIN, 1.85, CONTENT_W, 1.15);

  if (ch.atRiskCohorts.length > 0) {
    slide.addText('AT-RISK COHORTS', {
      x: MARGIN,
      y: 3.25,
      w: CONTENT_W,
      h: 0.3,
      fontFace: 'Inter',
      fontSize: 10,
      bold: true,
      color: '667085',
      charSpacing: 1,
    });
    ch.atRiskCohorts.forEach((c, i) => {
      addInsightCallout(slide, `${c.label}: ${c.count} customers`, MARGIN, 3.6 + i * 0.9, CONTENT_W, 0.75);
    });
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Recommendations ---------------------------------------------------------

function buildRecommendationsSlide(pptx: pptxgen, snapshot: ReportSnapshot, section: PlannedSection, label: string): void {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 'Prioritised Recommendations', 'Ranked by potential impact', label);

  const recs = snapshot.recommendations.slice(0, 6);
  const cardH = 0.85;
  const gap = 0.14;
  recs.forEach((r, i) => {
    addRecommendationCard(slide, r.priority, r.text, MARGIN, 1.9 + i * (cardH + gap), CONTENT_W, cardH);
  });

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Roadmap ---------------------------------------------------------------

function buildRoadmapSlide(pptx: pptxgen, snapshot: ReportSnapshot, section: PlannedSection, label: string): void {
  const roadmap = snapshot.strategicRoadmap;
  if (!roadmap) return;
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 'Strategic Action Roadmap', 'Sequenced from this report\'s findings', label);

  const colW = (CONTENT_W - (roadmap.length - 1) * 0.2) / roadmap.length;
  roadmap.forEach((phase, i) => {
    const x = MARGIN + i * (colW + 0.2);
    slide.addText(`PHASE ${String(phase.phase).padStart(2, '0')}`, {
      x,
      y: 1.9,
      w: colW,
      h: 0.28,
      fontFace: 'Inter',
      fontSize: 9,
      bold: true,
      color: '4318FF',
      charSpacing: 1,
    });
    slide.addText(phase.title, {
      x,
      y: 2.2,
      w: colW,
      h: 0.5,
      fontFace: 'Inter',
      fontSize: 14,
      bold: true,
      color: '0B1437',
    });
    slide.addText(phase.description, {
      x,
      y: 2.75,
      w: colW,
      h: 2.5,
      fontFace: 'Inter',
      fontSize: 10,
      color: '1B2559',
      valign: 'top',
    });
  });

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Methodology -------------------------------------------------------------

function buildMethodologySlide(pptx: pptxgen, snapshot: ReportSnapshot, section: PlannedSection, label: string): void {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 'Methodology, Privacy & Data Sources', 'How this report was built', label);

  const m = snapshot.methodology;
  let y = 1.9;
  slide.addText('DATA SOURCES', { x: MARGIN, y, w: CONTENT_W, h: 0.28, fontFace: 'Inter', fontSize: 10, bold: true, color: '667085', charSpacing: 1 });
  y += 0.34;
  for (const source of m.dataSources) {
    slide.addText(`${source.name}: ${source.description}`, {
      x: MARGIN,
      y,
      w: CONTENT_W,
      h: 0.32,
      fontFace: 'Inter',
      fontSize: 10.5,
      color: '1B2559',
    });
    y += 0.36;
  }

  y += 0.2;
  slide.addText('LIMITATIONS', { x: MARGIN, y, w: CONTENT_W, h: 0.28, fontFace: 'Inter', fontSize: 10, bold: true, color: '667085', charSpacing: 1 });
  y += 0.34;
  for (const limitation of m.limitations) {
    slide.addText(`•  ${limitation}`, { x: MARGIN, y, w: CONTENT_W, h: 0.4, fontFace: 'Inter', fontSize: 10.5, color: '1B2559' });
    y += 0.42;
  }

  slide.addText(
    `Report status: ${snapshot.privacy.approval.status}${snapshot.privacy.approval.reviewedBy ? ` · Reviewed by ${snapshot.privacy.approval.reviewedBy}` : ''}`,
    { x: MARGIN, y: SLIDE_H - 0.9, w: CONTENT_W, h: 0.3, fontFace: 'Inter', fontSize: 9, color: '667085' },
  );

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}

// -- Appendix (internal mode only) ------------------------------------------

function buildAppendixSlide(pptx: pptxgen, snapshot: ReportSnapshot, section: PlannedSection, label: string): void {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 'Appendix', 'Internal notes - not included in client-safe exports', label);

  const entries = Object.entries(snapshot.appendix ?? {}).filter(([key]) => key !== 'aiSummary');
  let y = 1.9;
  for (const [key, value] of entries) {
    slide.addText(`${key}: ${JSON.stringify(value)}`, { x: MARGIN, y, w: CONTENT_W, h: 0.4, fontFace: 'Inter', fontSize: 9, color: '667085' });
    y += 0.4;
  }

  addFooter(slide, sourceLine(snapshot), snapshot.metadata.mode);
}
