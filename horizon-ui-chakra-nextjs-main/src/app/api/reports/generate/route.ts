import { NextRequest, NextResponse } from 'next/server';

import { getCurrentSeller } from '@/lib/market-intel/seller';
import { collectSnapshot } from '@/lib/reports/collect-snapshot';
import { validateSnapshot } from '@/lib/reports/validate';
import { saveSnapshot } from '@/lib/reports/persist';
import { buildReportDeck } from '@/lib/reports/render/pptx/build-deck';
import { buildReportPdf } from '@/lib/reports/render/pdf/build-pdf';

const CONTENT_TYPES = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
} as const;

// A seller generating/downloading their own report from their own dashboard
// is not the "researcher reviews before client-safe delivery" flow from
// docs/reports-v2-architecture.md §7 - there's no cross-tenant exposure risk
// here (a seller can only ever see their own data), so this stays instant,
// self-serve, and always mode: 'internal'. The approval gate applies when a
// snapshot needs to leave the platform as a formal client_safe deliverable -
// that flow is not built yet (code audit, 2026-08-29): persist.ts already
// exports getSnapshot/listSnapshotsForSeller/transitionStatus/recordExport
// for it, and report_reviews/report_exports (migration 025) already exist
// with RLS, but nothing calls any of the four - no route, no UI. Don't cite
// a specific route path here again until one actually exists to link to.
export async function GET(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json({ succeeded: false, errors: ['Not authenticated'] }, { status: 401 });
  }

  const formatParam = request.nextUrl.searchParams.get('format');
  const format = formatParam === 'pdf' ? 'pdf' : 'pptx';

  const snapshot = await collectSnapshot(seller, { mode: 'internal' });
  const validation = validateSnapshot(snapshot);
  if (!validation.passed) {
    // A self-view download still gets a best-effort file rather than a hard
    // block - the blocking gate is for approved client_safe exports (see
    // export route). Logged for visibility, not surfaced to the seller.
    console.error(`[reports] snapshot for ${seller.id} failed validation:`, validation.issues);
  }

  const [buffer] = await Promise.all([
    format === 'pdf' ? buildReportPdf(snapshot) : buildReportDeck(snapshot),
    saveSnapshot(snapshot, 'seller_request').catch((err) => {
      console.error('[reports] failed to persist snapshot:', err);
    }),
  ]);

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
