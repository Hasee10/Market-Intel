import { NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { collectReportData } from '@/lib/reports/collect-report-data';
import { generateReportPptx } from '@/lib/reports/generate-pptx';

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json({ succeeded: false, errors: ['Not authenticated'] }, { status: 401 });
  }

  const reportData = await collectReportData(seller);
  const buffer = await generateReportPptx(reportData);

  const fileName = `${seller.businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-report.pptx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
