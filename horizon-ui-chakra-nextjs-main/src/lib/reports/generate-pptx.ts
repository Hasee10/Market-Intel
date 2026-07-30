'server-only';

import path from 'path';
import fs from 'fs';
import Automizer, { ModifyTableHelper, type ISlide } from 'pptx-automizer';

import type { ReportData, CompetitorTrackingRow, PortfolioRow } from './collect-report-data';
import { pctChange } from './collect-report-data';
import { formatCurrency } from './design-tokens';

const TEMPLATE_NAME = 'ryvl-report-template.pptx';
const TEMPLATE_PATH = path.join(process.cwd(), 'src/lib/reports/assets', TEMPLATE_NAME);

// Slides that get real seller data injected. Everything else (2, 4, 5, 6, 8,
// 11 - section dividers, methodology, and the illustrative percentile/price
// charts, which aren't backed by editable chart objects in the source file)
// is carried over unmodified from the template.
const DATA_SLIDES = new Set([1, 3, 7, 9, 10]);
const TOTAL_SLIDES = 11;

// Generic "set this shape's visible text" callback - the template is a
// Google-Slides export, so every shape has an auto-generated name like
// "Google Shape;133;p15" rather than a meaningful one. Collapsing every
// <a:t> run in the shape into the first and blanking the rest is safe here
// because none of the target shapes mix formatting mid-sentence.
function setShapeText(text: string) {
  return (element: Element) => {
    const runs = element.getElementsByTagName('a:t');
    if (runs.length === 0) return;
    (runs.item(0)!.firstChild as Text).data = text;
    for (let i = 1; i < runs.length; i++) {
      (runs.item(i)!.firstChild as Text).data = '';
    }
  };
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

function bulletOrFallback(items: string[], index: number, fallback: string): string {
  return items[index]?.trim() || fallback;
}

function padRows<T>(rows: T[], count: number): (T | null)[] {
  const out: (T | null)[] = rows.slice(0, count);
  while (out.length < count) out.push(null);
  return out;
}

function competitorTableRows(rows: CompetitorTrackingRow[]) {
  return padRows(rows, 5).map((row) =>
    row
      ? [
          row.title,
          row.priceDeltaPct != null ? `${row.priceDeltaPct >= 0 ? '+' : ''}${row.priceDeltaPct.toFixed(1)}%` : '—',
          row.stockState,
          row.signal,
          row.riskLevel,
        ]
      : ['No tracked listing', '—', '—', '—', '—'],
  );
}

function portfolioTableRows(rows: PortfolioRow[]) {
  return padRows(rows, 5).map((row) =>
    row
      ? [
          row.title,
          `${row.revenueSharePct.toFixed(0)}%`,
          row.priceIndex != null ? row.priceIndex.toFixed(0) : '—',
          row.stockRisk,
          row.strategicAction,
        ]
      : ['No product data', '—', '—', '—', '—'],
  );
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
      slide.modifyElement('Google Shape;134;p15', setShapeText(pctLabel(data.revenue, data.previousRevenue, 'vs prior period')));
      slide.modifyElement('Google Shape;136;p15', setShapeText(data.orderCount.toLocaleString()));
      slide.modifyElement(
        'Google Shape;137;p15',
        setShapeText(pctLabel(data.orderCount, data.previousOrderCount, 'volume growth', 'volume decline')),
      );
      slide.modifyElement('Google Shape;139;p15', setShapeText(data.priceIndex != null ? data.priceIndex.toFixed(1) : '—'));
      slide.modifyElement('Google Shape;140;p15', setShapeText(priceIndexDeltaLabel(data.priceIndex)));
      slide.modifyElement('Google Shape;142;p15', setShapeText(`${data.lowStockCount} SKU${data.lowStockCount === 1 ? '' : 's'}`));
      slide.modifyElement('Google Shape;143;p15', setShapeText(data.lowStockCount > 0 ? 'Action required' : 'On track'));

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
      slide.modifyElement('Google Shape;234;p19', [
        ModifyTableHelper.setTable({
          body: [
            { values: ['Tracked Product SKU', 'Price Delta', 'Stock State', 'Category Signal', 'Risk Level'] },
            ...competitorTableRows(data.competitorTracking).map((values) => ({ values })),
          ],
        }),
      ]);
    };
  }

  if (n === 9) {
    return (slide) => {
      slide.modifyElement('Google Shape;308;p21', [
        ModifyTableHelper.setTable({
          body: [
            { values: ['Product Line', 'Revenue Share', 'Price Index', 'Stock Risk', 'Strategic Action'] },
            ...portfolioTableRows(data.portfolioMatrix).map((values) => ({ values })),
          ],
        }),
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
    pres.addSlide(TEMPLATE_NAME, n, DATA_SLIDES.has(n) ? slideCallback(n, data) : undefined);
  }

  const zip = await pres.getJSZip();
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return buffer;
}
