'server-only';

import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import type { ReportSnapshot, ReportStatus } from './schema';

export interface StoredReportSnapshot {
  id: string;
  sellerId: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  version: number;
  status: ReportStatus;
  mode: 'internal' | 'client_safe';
  data: ReportSnapshot;
  dataHash: string;
  generatedBy: string;
  createdAt: string;
}

function hashSnapshot(data: ReportSnapshot): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// Writes go through the admin (service-role) client, same pattern as
// scraper_runs/seller_price_alerts writes - report_snapshots' RLS policy
// only grants sellers read access to their own rows, matching the "no
// self-serve seller review" decision in docs/reports-v2-architecture.md §7.
export async function saveSnapshot(
  snapshot: ReportSnapshot,
  generatedBy: 'seller_request' | 'scheduled' | 'internal_staff',
): Promise<StoredReportSnapshot> {
  const supabase = createAdminClient();
  const dataHash = hashSnapshot(snapshot);

  const { data: existing } = await supabase
    .from('report_snapshots')
    .select('version')
    .eq('seller_id', snapshot.workspace.sellerId)
    .eq('report_type', snapshot.metadata.reportType)
    .eq('period_start', snapshot.metadata.period.start.slice(0, 10))
    .eq('period_end', snapshot.metadata.period.end.slice(0, 10))
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (existing?.version ?? 0) + 1;
  snapshot.metadata.version = version;

  const { data, error } = await supabase
    .from('report_snapshots')
    .insert({
      seller_id: snapshot.workspace.sellerId,
      report_type: snapshot.metadata.reportType,
      period_start: snapshot.metadata.period.start.slice(0, 10),
      period_end: snapshot.metadata.period.end.slice(0, 10),
      version,
      status: snapshot.metadata.status,
      mode: snapshot.metadata.mode,
      data: snapshot,
      data_hash: dataHash,
      generated_by: generatedBy,
    })
    .select('id, seller_id, report_type, period_start, period_end, version, status, mode, data, data_hash, generated_by, created_at')
    .single();

  if (error || !data) throw new Error(`Failed to save report snapshot: ${error?.message}`);

  return rowToSnapshot(data);
}

export async function getSnapshot(id: string): Promise<StoredReportSnapshot | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('report_snapshots')
    .select('id, seller_id, report_type, period_start, period_end, version, status, mode, data, data_hash, generated_by, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return rowToSnapshot(data);
}

export async function listSnapshotsForSeller(sellerId: string, limit = 20): Promise<StoredReportSnapshot[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('report_snapshots')
    .select('id, seller_id, report_type, period_start, period_end, version, status, mode, data, data_hash, generated_by, created_at')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(rowToSnapshot);
}

// Append-only status transition - writes a new report_reviews row and
// updates the status column in place (the status column itself is mutable
// state, unlike the row's data/version, which never changes after insert).
//
// SECURITY: this function has no caller-identity check of its own - it
// trusts `reviewerIdentifier` completely and will happily transition any
// snapshot to 'approved' for whoever calls it. That's safe today only
// because nothing in production calls it yet (Phase 5 of
// docs/reports-v2-architecture.md - the internal staff review API - isn't
// built). When that API is built, it must authenticate the caller as
// internal staff BEFORE calling this, not after; this function is a
// low-level primitive, not the authorization boundary.
export async function transitionStatus(
  snapshotId: string,
  newStatus: ReportStatus,
  reviewerIdentifier: string,
  action: 'edit' | 'approve' | 'reject' | 'comment',
  notes?: string,
): Promise<void> {
  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from('report_snapshots')
    .update({ status: newStatus })
    .eq('id', snapshotId);
  if (updateError) throw new Error(`Failed to update snapshot status: ${updateError.message}`);

  const { error: reviewError } = await supabase.from('report_reviews').insert({
    report_snapshot_id: snapshotId,
    reviewer_identifier: reviewerIdentifier,
    action,
    notes: notes ?? null,
  });
  if (reviewError) throw new Error(`Failed to record review: ${reviewError.message}`);
}

export async function recordExport(snapshotId: string, format: 'pptx' | 'pdf', storagePath: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('report_exports').insert({ report_snapshot_id: snapshotId, format, storage_path: storagePath });
}

function rowToSnapshot(row: {
  id: string;
  seller_id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  version: number;
  status: string;
  mode: string;
  data: ReportSnapshot;
  data_hash: string;
  generated_by: string;
  created_at: string;
}): StoredReportSnapshot {
  return {
    id: row.id,
    sellerId: row.seller_id,
    reportType: row.report_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    version: row.version,
    status: row.status as ReportStatus,
    mode: row.mode as 'internal' | 'client_safe',
    data: row.data,
    dataHash: row.data_hash,
    generatedBy: row.generated_by,
    createdAt: row.created_at,
  };
}
