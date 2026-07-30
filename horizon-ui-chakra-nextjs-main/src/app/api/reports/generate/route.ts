import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { collectReportData } from '@/lib/reports/collect-report-data';
import { generateReportPdf } from '@/lib/reports/generate-pdf';
import { generateReportPptx } from '@/lib/reports/generate-pptx';

const CONTENT_TYPES = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
} as const;

export async function GET(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json({ succeeded: false, errors: ['Not authenticated'] }, { status: 401 });
  }

  const formatParam = request.nextUrl.searchParams.get('format');
  const format = formatParam === 'pdf' ? 'pdf' : 'pptx';

  const reportData = await collectReportData(seller);
  const buffer = format === 'pdf' ? await generateReportPdf(reportData) : await generateReportPptx(reportData);

  const slug = seller.businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const fileName = `${slug}-report.${format}`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPES[format],
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
