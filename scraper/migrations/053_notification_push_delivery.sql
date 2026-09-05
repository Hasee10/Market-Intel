-- Delivery tracking for push notifications.
--
-- seller_notifications has is_read, but that is the seller having *seen* the
-- alert in the app - a different fact from us having *sent* a push for it.
-- Without a column for the second one, the delivery job has no way to tell a
-- new alert from one it already delivered, and every run would re-push every
-- undismissed notification. That is not a small bug: the low-stock job writes
-- daily and the price-alert job every six hours, so within a week a seller
-- would be getting the same alert dozens of times.
--
-- Nullable rather than a boolean default false, because the timestamp is
-- worth having when debugging "why did this arrive twice" - a boolean tells
-- you it was sent, this tells you when.
--
-- Apply manually via the Supabase SQL Editor, same convention as 001-052.

alter table seller_notifications
  add column if not exists pushed_at timestamptz;

-- THE BACKFILL MATTERS. Every existing row currently has pushed_at null,
-- which the job reads as "never delivered". Turning delivery on without
-- this would push every historical notification a seller has ever received
-- the first time the job runs - the exact opposite of the feature.
--
-- Stamped with created_at rather than now() so the column keeps meaning
-- "when this was considered for delivery" instead of collapsing the whole
-- backlog to one timestamp. Only touches rows that predate this migration;
-- anything written after it is genuinely undelivered and must stay null.
update seller_notifications
   set pushed_at = created_at
 where pushed_at is null;

-- The job's access pattern: undelivered notifications, newest-first, within
-- a recent window. Partial index because the delivered rows are the vast
-- majority and are never scanned by this query - indexing them would cost
-- write throughput on every notification insert for nothing.
create index if not exists seller_notifications_undelivered_idx
  on seller_notifications (created_at)
  where pushed_at is null;

comment on column seller_notifications.pushed_at is
  'When the push-delivery job processed this row. Null means undelivered. Set even when the seller has no registered device, so a device registered later does not receive a backlog.';
