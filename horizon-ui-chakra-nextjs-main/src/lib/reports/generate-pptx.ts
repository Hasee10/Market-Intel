'server-only';

import PptxGenJS from 'pptxgenjs';

import type { ReportData } from './collect-report-data';

const BRAND_INDIGO = '4318FF';
const BRAND_NAVY = '111C4E';
const GRAY = '667085';

function formatCurrency(value: number, currency = 'PKR') {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function formatMetricName(metricName: string) {
  return metricName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Builds a client-shareable summary deck from a seller's own dashboard
// numbers - meant for a researcher/analyst to review and hand off, not a
// raw data dump. Kept to 4-5 slides on purpose: this backs a "send this to
// a client" use case, not an exhaustive report.
export async function generateReportPptx(data: ReportData): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'RYVL_16x9', width: 10, height: 5.63 });
  pptx.layout = 'RYVL_16x9';

  // ===== Title slide =====
  const title = pptx.addSlide();
  title.background = { color: BRAND_NAVY };
  title.addText('Ryvl', { x: 0.5, y: 0.4, fontSize: 20, bold: true, color: 'FFFFFF' });
  title.addText(data.seller.businessName, {
    x: 0.5,
    y: 2.0,
    fontSize: 32,
    bold: true,
    color: 'FFFFFF',
  });
  title.addText('Market Intelligence Report', {
    x: 0.5,
    y: 2.7,
    fontSize: 18,
    color: 'C7D2FE',
  });
  title.addText(
    `${data.periodLabel} - ${data.domainName ?? 'No domain set'} - Generated ${new Date().toLocaleDateString()}`,
    { x: 0.5, y: 4.8, fontSize: 11, color: '9AA5D1' },
  );

  // ===== Store performance slide =====
  const perf = pptx.addSlide();
  perf.addText('Store performance', { x: 0.4, y: 0.3, fontSize: 22, bold: true, color: BRAND_NAVY });
  perf.addText(data.periodLabel, { x: 0.4, y: 0.75, fontSize: 11, color: GRAY });

  const stats: [string, string][] = [
    ['Revenue', formatCurrency(data.revenue)],
    ['Orders', String(data.orderCount)],
    ['Average order value', formatCurrency(data.avgOrderValue)],
    ['Active products', String(data.activeProductCount)],
  ];
  stats.forEach(([label, value], i) => {
    const x = 0.4 + (i % 2) * 4.8;
    const y = 1.5 + Math.floor(i / 2) * 1.3;
    perf.addText(value, { x, y, w: 4.4, fontSize: 26, bold: true, color: BRAND_INDIGO });
    perf.addText(label, { x, y: y + 0.55, w: 4.4, fontSize: 12, color: GRAY });
  });

  // ===== Top products slide =====
  if (data.topProducts.length > 0) {
    const products = pptx.addSlide();
    products.addText('Top products by inventory value', {
      x: 0.4,
      y: 0.3,
      fontSize: 22,
      bold: true,
      color: BRAND_NAVY,
    });
    const rows: PptxGenJS.TableRow[] = [
      [
        { text: 'Product', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_INDIGO } } },
        { text: 'Inventory value', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_INDIGO } } },
      ],
      ...data.topProducts.map((p) => [{ text: p.title }, { text: formatCurrency(p.inventoryValue) }]),
    ];
    products.addTable(rows, { x: 0.4, y: 1.1, w: 9.2, fontSize: 12, autoPage: false });
  }

  // ===== Market benchmarks slide =====
  if (data.benchmarks.length > 0 || data.categoryPricing) {
    const market = pptx.addSlide();
    market.addText('Market position', { x: 0.4, y: 0.3, fontSize: 22, bold: true, color: BRAND_NAVY });
    market.addText(data.domainName ?? '', { x: 0.4, y: 0.75, fontSize: 11, color: GRAY });

    let y = 1.3;
    if (data.benchmarks.length > 0) {
      market.addText('Peer benchmarks (your domain)', { x: 0.4, y, fontSize: 13, bold: true, color: BRAND_NAVY });
      y += 0.4;
      const rows: PptxGenJS.TableRow[] = [
        [
          { text: 'Metric', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_INDIGO } } },
          { text: 'Median', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_INDIGO } } },
          { text: 'Sample size', options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_INDIGO } } },
        ],
        ...data.benchmarks.map((b) => [
          { text: formatMetricName(b.metricName) },
          { text: b.median != null ? String(b.median) : '-' },
          { text: String(b.sampleSize) },
        ]),
      ];
      market.addTable(rows, { x: 0.4, y, w: 9.2, fontSize: 11, autoPage: false });
      y += 0.4 * (data.benchmarks.length + 1);
    }

    if (data.categoryPricing) {
      market.addText('Competitor pricing (category-wide)', {
        x: 0.4,
        y: y + 0.2,
        fontSize: 13,
        bold: true,
        color: BRAND_NAVY,
      });
      market.addText(
        `P25 ${formatCurrency(data.categoryPricing.p25)}  |  Median ${formatCurrency(data.categoryPricing.median)}  |  P75 ${formatCurrency(data.categoryPricing.p75)}  |  ${data.categoryPricing.count} listings tracked`,
        { x: 0.4, y: y + 0.6, fontSize: 12, color: GRAY },
      );
    }
  }

  // ===== Retention slide =====
  if (data.churn) {
    const retention = pptx.addSlide();
    retention.addText('Customer retention', { x: 0.4, y: 0.3, fontSize: 22, bold: true, color: BRAND_NAVY });

    const churnStats: [string, string][] = [
      ['Retention rate', data.churn.retentionRate != null ? `${data.churn.retentionRate.toFixed(1)}%` : '-'],
      ['Repeat purchase rate', data.churn.repeatPurchaseRate != null ? `${data.churn.repeatPurchaseRate.toFixed(1)}%` : '-'],
      ['Avg. customer value', data.churn.avgClv != null ? formatCurrency(data.churn.avgClv) : '-'],
    ];
    churnStats.forEach(([label, value], i) => {
      const x = 0.4 + i * 3.1;
      retention.addText(value, { x, y: 1.5, w: 2.9, fontSize: 24, bold: true, color: BRAND_INDIGO });
      retention.addText(label, { x, y: 2.05, w: 2.9, fontSize: 12, color: GRAY });
    });
  }

  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return buffer;
}
