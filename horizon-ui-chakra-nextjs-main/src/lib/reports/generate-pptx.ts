'server-only';

import path from 'path';
import fs from 'fs';
import Automizer, { ModifyTableHelper, type ISlide } from 'pptx-automizer';
import type { TableRowStyle } from 'pptx-automizer';

import type { ReportData, CompetitorTrackingRow, PortfolioRow } from './collect-report-data';
import { pctChange } from './collect-report-data';
import { formatCurrency } from './design-tokens';

// The template's own color language (not lib/reports/design-tokens.ts's
// dashboard palette) - matched by inspecting the source pptx's existing
// conditional text colors (e.g. the demo's "+12.4%"/"−7.5%" cells) so
// dynamically-colored text stays pixel-consistent with this specific deck.
const POSITIVE = '10B981';
const NEGATIVE = 'EF4444';
const NEUTRAL = '64748B';
const INFO = 'F59E0B';

const TEMPLATE_NAME = 'ryvl-report-template.pptx';
const TEMPLATE_PATH = path.join(process.cwd(), 'src/lib/reports/assets', TEMPLATE_NAME);

// Slides that get real seller data injected. Everything else (2, 4, 5, 6, 8,
// 11 - section dividers, methodology, and the illustrative percentile/price
// charts, which aren't backed by editable chart objects in the source file)
// is carried over unmodified from the template.
const DATA_SLIDES = new Set([1, 3, 7, 9, 10]);
const TOTAL_SLIDES = 11;

// The template's "status pill" look (e.g. red "High Risk", green "In Stock")
// on slides 7 and 9 is not a table cell style at all - it's a fixed set of
// pre-rendered PNG images absolutely positioned over the table (see the
// investigation that led here: p:pic elements at these exact y-offsets,
// unrelated to any table cell). Static images can't reflect real per-seller
// data, so those shapes are removed and replaced with dynamically colored
// bold text in the actual table cells instead.
const BADGE_IMAGE_NAMES: Record<number, string[]> = {
  7: [
    'Google Shape;267;p19',
    'Google Shape;268;p19',
    'Google Shape;269;p19',
    'Google Shape;270;p19',
    'Google Shape;271;p19',
    'Google Shape;272;p19',
    'Google Shape;273;p19',
    'Google Shape;274;p19',
    'Google Shape;275;p19',
    'Google Shape;276;p19',
  ],
  9: [
    'Google Shape;341;p21',
    'Google Shape;342;p21',
    'Google Shape;343;p21',
    'Google Shape;344;p21',
    'Google Shape;345;p21',
  ],
};

const RISK_COLOR: Record<string, string> = {
  'High Risk': NEGATIVE,
  High: NEGATIVE,
  Medium: INFO,
  'Low Risk': POSITIVE,
  Low: POSITIVE,
  Opportunity: INFO,
  'In Stock': POSITIVE,
  'Out of Stock': NEGATIVE,
};

function coloredBold(label: string): TableRowStyle {
  return { color: { type: 'srgbClr', value: RISK_COLOR[label] ?? NEUTRAL }, isBold: true };
}

function deltaColor(diff: number): string {
  if (Math.abs(diff) < 0.05) return NEUTRAL;
  return diff > 0 ? POSITIVE : NEGATIVE;
}

// Generic "set this shape's visible text" callback - the template is a
// Google-Slides export, so every shape has an auto-generated name like
// "Google Shape;133;p15" rather than a meaningful one. Collapsing every
// <a:t> run in the shape into the first and blanking the rest is safe here
// because none of the target shapes mix formatting mid-sentence.
//
// Several of these shapes (revenue/order/price-index deltas, the stockout
// "Action required" label) come from the template with a color baked onto
// that specific demo value (green for a positive delta, red for "Action
// required"). Since only the text was being replaced, a real seller whose
// numbers went the other way would show the wrong-colored text - passing
// `color` here re-derives it from the actual computed value instead of
// inheriting whatever the template's demo content happened to have.
function setShapeText(text: string, color?: string) {
  return (element: Element) => {
    const runs = element.getElementsByTagName('a:t');
    if (runs.length === 0) return;
    (runs.item(0)!.firstChild as Text).data = text;
    for (let i = 1; i < runs.length; i++) {
      (runs.item(i)!.firstChild as Text).data = '';
    }
    if (color) {
      const fill = element.getElementsByTagName('a:srgbClr').item(0);
      fill?.setAttribute('val', color);
    }
  };
}

// The wordmark textbox next to the small chevron logo on every slide is
// sized for exactly the word "Ryvl" at a width that some renderers (Google
// Slides' own preview) wrap onto a second, clipped line - a pre-existing
// sizing issue in the source template, not something this generator
// introduces. Widening it here (found by exact text match, not shape name,
// since the name differs on every slide) fixes it deck-wide in one place.
function widenLogoWordmark(document: Document) {
  const shapes = document.getElementsByTagName('p:sp');
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes.item(i);
    const runs = shape.getElementsByTagName('a:t');
    let text = '';
    for (let r = 0; r < runs.length; r++) text += runs.item(r)!.textContent;
    if (text.trim() !== 'Ryvl') continue;

    const ext = shape.getElementsByTagName('a:ext').item(0);
    if (ext && Number(ext.getAttribute('cx')) < 700000) {
      ext.setAttribute('cx', '700000');
    }
  }
}

function pctLabel(current: number, previous: number, positiveSuffix: string, negativeSuffix = positiveSuffix): string {
  const diff = pctChange(current, previous);
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}% ${diff >= 0 ? positiveSuffix : negativeSuffix}`;
}

function priceIndexDeltaLabel(priceIndex: number | null): string {
  if (priceIndex == null) return 'No category benchmark available';
  const diff = priceIndex - 100;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}% ${diff < 0 ? 'below' : 'above'} median`;
}

// Pricing below median isn't necessarily bad (could be a deliberate
// value-positioning strategy), so this reads informational (amber) rather
// than alarming (red) - matches the template's own demo, which colored a
// below-median price index amber, not red.
function priceIndexDeltaColor(priceIndex: number | null): string {
  if (priceIndex == null) return NEUTRAL;
  return priceIndex >= 100 ? POSITIVE : INFO;
}

function bulletOrFallback(items: string[], index: number, fallback: string): string {
  return items[index]?.trim() || fallback;
}

function padRows<T>(rows: T[], count: number): (T | null)[] {
  const out: (T | null)[] = rows.slice(0, count);
  while (out.length < count) out.push(null);
  return out;
}

type TableRowInput = { values: (string | number)[]; styles?: (null | TableRowStyle)[] };

const NEUTRAL_BOLD: TableRowStyle = { color: { type: 'srgbClr', value: NEUTRAL }, isBold: true };

function competitorTableRows(rows: CompetitorTrackingRow[]): TableRowInput[] {
  return padRows(rows, 5).map((row) => {
    // Every row - including the "no data" placeholder - gets an explicit
    // style for these columns. Leaving styles unset here would silently
    // inherit whatever color the template's own demo content had baked in
    // (e.g. red for "-7.5%"), regardless of what's actually being shown.
    if (!row) {
      return { values: ['No tracked listing', '—', '—', '—', '—'], styles: [null, NEUTRAL_BOLD, NEUTRAL_BOLD, null, NEUTRAL_BOLD] };
    }
    const priceDeltaLabel =
      row.priceDeltaPct != null ? `${row.priceDeltaPct >= 0 ? '+' : ''}${row.priceDeltaPct.toFixed(1)}%` : '—';
    const values = [row.title, priceDeltaLabel, row.stockState, row.signal, row.riskLevel];
    const priceDeltaStyle: TableRowStyle = {
      color: { type: 'srgbClr', value: row.priceDeltaPct != null ? deltaColor(row.priceDeltaPct) : NEUTRAL },
      isBold: true,
    };
    return {
      values,
      styles: [null, priceDeltaStyle, coloredBold(row.stockState), null, coloredBold(row.riskLevel)],
    };
  });
}

function portfolioTableRows(rows: PortfolioRow[]): TableRowInput[] {
  return padRows(rows, 5).map((row) => {
    if (!row) {
      return { values: ['No product data', '—', '—', '—', '—'], styles: [null, null, null, NEUTRAL_BOLD, null] };
    }
    const values = [
      row.title,
      `${row.revenueSharePct.toFixed(0)}%`,
      row.priceIndex != null ? row.priceIndex.toFixed(0) : '—',
      row.stockRisk,
      row.strategicAction,
    ];
    return { values, styles: [null, null, null, coloredBold(row.stockRisk), null] };
  });
}

function buildKeyInsight(rows: PortfolioRow[]): string {
  if (rows.length === 0) return 'Key Insight:  Add products to see portfolio contribution insights.';
  const top = rows.slice(0, 2);
  const sum = top.reduce((s, r) => s + r.revenueSharePct, 0);
  return `Key Insight:  Top ${top.length} product line${top.length > 1 ? 's' : ''} generate ${sum.toFixed(0)}% of revenue. Securing inventory for ${rows[0].title} is a priority.`;
}

function coverRefCode(businessName: string): string {
  const slug = businessName.replace(/[^A-Za-z0-9]+/g, '').slice(0, 6).toUpperCase() || 'EXEC';
  return `Ref: RYVL-${slug}-${new Date().getFullYear()}`;
}

function slideCallback(n: number, data: ReportData): ((slide: ISlide) => void) | undefined {
  const businessName = data.seller.businessName;

  if (n === 1) {
    return (slide) => {
      slide.modifyElement('Google Shape;86;p13', setShapeText(coverRefCode(businessName)));
      slide.modifyElement('Google Shape;89;p13', setShapeText(`Prepared for: ${businessName}`));
      slide.modifyElement(
        'Google Shape;90;p13',
        setShapeText(`Generated: ${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })} | Confidential`),
      );
    };
  }

  if (n === 3) {
    return (slide) => {
      slide.modifyElement('Google Shape;133;p15', setShapeText(formatCurrency(data.revenue)));
      slide.modifyElement(
        'Google Shape;134;p15',
        setShapeText(
          pctLabel(data.revenue, data.previousRevenue, 'vs prior period'),
          deltaColor(pctChange(data.revenue, data.previousRevenue)),
        ),
      );
      slide.modifyElement('Google Shape;136;p15', setShapeText(data.orderCount.toLocaleString()));
      slide.modifyElement(
        'Google Shape;137;p15',
        setShapeText(
          pctLabel(data.orderCount, data.previousOrderCount, 'volume growth', 'volume decline'),
          deltaColor(pctChange(data.orderCount, data.previousOrderCount)),
        ),
      );
      slide.modifyElement('Google Shape;139;p15', setShapeText(data.priceIndex != null ? data.priceIndex.toFixed(1) : '—'));
      slide.modifyElement(
        'Google Shape;140;p15',
        setShapeText(priceIndexDeltaLabel(data.priceIndex), priceIndexDeltaColor(data.priceIndex)),
      );
      slide.modifyElement('Google Shape;142;p15', setShapeText(`${data.lowStockCount} SKU${data.lowStockCount === 1 ? '' : 's'}`));
      slide.modifyElement(
        'Google Shape;143;p15',
        setShapeText(data.lowStockCount > 0 ? 'Action required' : 'On track', data.lowStockCount > 0 ? NEGATIVE : POSITIVE),
      );

      const highlights = data.insights.highlights;
      slide.modifyElement(
        'Google Shape;152;p15',
        setShapeText(bulletOrFallback(highlights, 0, 'Market conditions shifted for tracked categories this cycle.')),
      );
      slide.modifyElement(
        'Google Shape;154;p15',
        setShapeText(bulletOrFallback(highlights, 1, 'Tracked competitors adjusted pricing across marketplaces.')),
      );
      slide.modifyElement(
        'Google Shape;156;p15',
        setShapeText(bulletOrFallback(highlights, 2, 'Demand velocity detected for top-performing SKUs.')),
      );

      const actions = data.insights.recommendedActions;
      slide.modifyElement(
        'Google Shape;159;p15',
        setShapeText(bulletOrFallback(actions, 0, 'Review pricing on top SKUs against category median.')),
      );
      slide.modifyElement(
        'Google Shape;161;p15',
        setShapeText(bulletOrFallback(actions, 1, 'Reorder high-turnover inventory nearing low-stock threshold.')),
      );
      slide.modifyElement(
        'Google Shape;163;p15',
        setShapeText(bulletOrFallback(actions, 2, 'Expand watchlist coverage to emerging competitors.')),
      );
    };
  }

  if (n === 7) {
    return (slide) => {
      for (const name of BADGE_IMAGE_NAMES[7]) slide.removeElement(name);
      slide.modifyElement('Google Shape;234;p19', [
        ModifyTableHelper.setTable(
          {
            body: [
              { values: ['Tracked Product SKU', 'Price Delta', 'Stock State', 'Category Signal', 'Risk Level'] },
              ...competitorTableRows(data.competitorTracking),
            ],
          },
          // Preserve the template's own column widths/row heights exactly -
          // setTable()'s default adjustWidth/adjustHeight force-equalize
          // every column and row, which is what broke this table's layout.
          { adjustWidth: false, adjustHeight: false },
        ),
      ]);
    };
  }

  if (n === 9) {
    return (slide) => {
      for (const name of BADGE_IMAGE_NAMES[9]) slide.removeElement(name);
      slide.modifyElement('Google Shape;308;p21', [
        ModifyTableHelper.setTable(
          {
            body: [
              { values: ['Product Line', 'Revenue Share', 'Price Index', 'Stock Risk', 'Strategic Action'] },
              ...portfolioTableRows(data.portfolioMatrix),
            ],
          },
          { adjustWidth: false, adjustHeight: false },
        ),
      ]);
      slide.modifyElement('Google Shape;339;p21', setShapeText(buildKeyInsight(data.portfolioMatrix)));
    };
  }

  if (n === 10) {
    const topProduct = data.portfolioMatrix[0]?.title ?? 'Your top-selling product';
    const retentionNote =
      data.churn?.retentionRate != null
        ? `Limit promotional discount codes to high-value at-risk customers (current retention: ${data.churn.retentionRate.toFixed(0)}%) to prevent unnecessary margin erosion.`
        : 'Limit promotional discount codes strictly to high-LTV at-risk customer cohorts to prevent unnecessary margin erosion.';

    return (slide) => {
      slide.modifyElement(
        'Google Shape;363;p22',
        setShapeText(
          `Identify ${data.atRiskCount} account${data.atRiskCount === 1 ? '' : 's'} inactive over the last 30 days. Trigger automated targeted re-engagement offers before complete churn.`,
        ),
      );
      slide.modifyElement(
        'Google Shape;367;p22',
        setShapeText(
          `${topProduct} is a strong candidate for bundling with complementary items in your catalog. Creating bundle kits can help boost average order value.`,
        ),
      );
      slide.modifyElement('Google Shape;371;p22', setShapeText(retentionNote));
    };
  }

  return undefined;
}

// Generates the Ryvl enterprise report by cloning the real designer-built
// template (src/lib/reports/assets/ryvl-report-template.pptx, an 11-slide
// deck with embedded Inter/Plus Jakarta Sans fonts) slide-for-slide and
// swapping in real seller data via pptx-automizer, rather than hand-drawing
// shapes. This keeps every position, font, and color exactly as designed -
// the output stays fully editable in PowerPoint.
export async function generateReportPptx(data: ReportData): Promise<Buffer> {
  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);

  const automizer = new Automizer({
    removeExistingSlides: true,
    autoImportSlideMasters: true,
    // Without this, the original root copy's now-unused slide/media/layout
    // parts stay zipped into the output as orphaned files (roughly doubling
    // file size) even though removeExistingSlides drops them from the
    // visible slide list.
    cleanup: true,
  });

  const pres = automizer.loadRoot(templateBuffer).load(templateBuffer, TEMPLATE_NAME);

  for (let n = 1; n <= TOTAL_SLIDES; n++) {
    const dataCallback = DATA_SLIDES.has(n) ? slideCallback(n, data) : undefined;
    pres.addSlide(TEMPLATE_NAME, n, (slide) => {
      slide.modify(widenLogoWordmark);
      dataCallback?.(slide);
    });
  }

  const zip = await pres.getJSZip();
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return buffer;
}
