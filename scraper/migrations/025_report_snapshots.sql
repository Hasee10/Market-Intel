-- Backs the report generation v2 system (docs/reports-v2-architecture.md).
-- Three tables, append-only in spirit (a regeneration is a new row with a
-- bumped version, never an overwrite) - same idiom as scraper_runs and
-- market_price_history, per mind.md's established convention.
--
-- Apply manually via the Supabase SQL Editor, same convention as 001-024.

-- ---------------------------------------------------------------------------
-- 1. report_snapshots - one row per generated report
-- ---------------------------------------------------------------------------

create table if not exists report_snapshots (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  report_type text not null,
  period_start date not null,
  period_end date not null,
  version integer not null default 1,
  status text not null default 'draft',
  mode text not null default 'internal',
  data jsonb not null,
  data_hash text not null,
  generated_by text not null,
  created_at timestamptz not null default now(),
  constraint report_snapshots_status_check check (status in ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  constraint report_snapshots_mode_check check (mode in ('internal', 'client_safe'))
);

create index if not exists report_snapshots_seller_idx on report_snapshots (seller_id, created_at desc);

alter table report_snapshots enable row level security;

drop policy if exists report_snapshots_owner_select on report_snapshots;
create policy report_snapshots_owner_select on report_snapshots
  for select to authenticated
  using (seller_id in (select id from sellers where user_id = auth.uid()));

-- Insert/update is service-role only (the report pipeline runs server-side
-- with the service-role client, same as seller_price_alerts/scraper_runs) -
-- no policy needed beyond RLS being enabled, since service-role bypasses RLS.

-- ---------------------------------------------------------------------------
-- 2. report_reviews - append-only audit trail of review actions
-- ---------------------------------------------------------------------------

create table if not exists report_reviews (
  id uuid primary key default gen_random_uuid(),
  report_snapshot_id uuid not null references report_snapshots(id) on delete cascade,
  reviewer_identifier text not null,
  action text not null,
  notes text,
  field_changes jsonb,
  created_at timestamptz not null default now(),
  constraint report_reviews_action_check check (action in ('comment', 'edit', 'approve', 'reject'))
);

create index if not exists report_reviews_snapshot_idx on report_reviews (report_snapshot_id, created_at);

alter table report_reviews enable row level security;

drop policy if exists report_reviews_owner_select on report_reviews;
create policy report_reviews_owner_select on report_reviews
  for select to authenticated
  using (
    report_snapshot_id in (
      select id from report_snapshots where seller_id in (select id from sellers where user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 3. report_exports - one row per exported file (a snapshot can be
--    exported multiple times/formats)
-- ---------------------------------------------------------------------------

create table if not exists report_exports (
  id uuid primary key default gen_random_uuid(),
  report_snapshot_id uuid not null references report_snapshots(id) on delete cascade,
  format text not null,
  storage_path text not null,
  exported_at timestamptz not null default now(),
  constraint report_exports_format_check check (format in ('pptx', 'pdf'))
);

create index if not exists report_exports_snapshot_idx on report_exports (report_snapshot_id, exported_at desc);

alter table report_exports enable row level security;

drop policy if exists report_exports_owner_select on report_exports;
create policy report_exports_owner_select on report_exports
  for select to authenticated
  using (
    report_snapshot_id in (
      select id from report_snapshots where seller_id in (select id from sellers where user_id = auth.uid())
    )
  );
