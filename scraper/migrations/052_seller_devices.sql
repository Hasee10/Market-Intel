-- Push-notification device registry for the mobile app.
--
-- The alerts themselves already exist: the low-stock and price-alert crons
-- have been writing seller_notifications daily since migration 014. What
-- has never existed is anywhere to record *where* to deliver them, which is
-- the only thing standing between that feed and a push notification.
--
-- One row per device per seller, not per seller: a seller with a phone and
-- a tablet gets both, and someone signing into the app on a replacement
-- handset should not silently stop receiving alerts on it.
--
-- The token is the natural key. Push providers reissue tokens on reinstall
-- and occasionally on OS upgrade, so the unique constraint is on the token
-- rather than (seller_id, platform) - the same physical device legitimately
-- produces a new row when its token rotates, and the stale one is cleaned
-- up when the provider reports it invalid on send.
--
-- RLS follows the same owner-only pattern as seller_watchlists (014): a
-- seller reads and writes only their own devices. The send job runs with
-- the service-role key and bypasses RLS, exactly as the existing
-- notification jobs do.
--
-- Apply manually via the Supabase SQL Editor, same convention as 001-051.

create table if not exists seller_devices (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  -- Opaque to us: an Expo push token, an FCM registration id, or an APNs
  -- device token, depending on what the app ships with. Stored as text
  -- rather than parsed, because the provider owns the format.
  push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  -- Useful when debugging "why did this one device stop getting alerts" -
  -- a token that stopped working right after an app update is a different
  -- story from one that never worked.
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (push_token)
);

-- The send job's access pattern: every active device for one seller.
create index if not exists seller_devices_seller_idx on seller_devices (seller_id);

alter table seller_devices enable row level security;

drop policy if exists seller_devices_owner_all on seller_devices;

create policy seller_devices_owner_all on seller_devices
  for all
  using (
    seller_id in (select id from sellers where user_id = auth.uid())
  )
  with check (
    seller_id in (select id from sellers where user_id = auth.uid())
  );

comment on table seller_devices is
  'Push notification targets for the mobile app. One row per device token; the delivery job reads these with the service-role key.';
