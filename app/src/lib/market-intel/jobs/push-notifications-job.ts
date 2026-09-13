'server-only';

import {
  chunkForPush,
  isDeadTokenTicket,
  sendPushBatch,
  type PushMessage,
} from '@/lib/notifications/push';
import { createAdminClient } from '@/lib/supabase/server';

// Delivers seller_notifications to registered devices as push notifications.
//
// The alert data has existed since migration 014 - the low-stock and
// price-alert crons have been writing it daily - and migration 052 added
// somewhere to record device tokens. This is the piece that joins them.
//
// Requires migration 053 (seller_notifications.pushed_at). Without it every
// run re-delivers every notification, so the job checks for the column and
// refuses rather than spamming.

/**
 * Notifications older than this are marked delivered without being sent.
 *
 * If the job is broken or unscheduled for a week, the fix must not be to
 * dump a week of alerts onto a phone the moment it starts working again -
 * a seller waking up to sixty notifications will disable them permanently,
 * and a two-day-old stock warning is not worth interrupting anyone for.
 * They are still in the in-app feed, which is where history belongs.
 */
const MAX_AGE_HOURS = 24;

/** Ceiling per run, so one bad day cannot become one enormous send. */
const MAX_NOTIFICATIONS_PER_RUN = 500;

export type PushJobResult = {
  notificationsConsidered: number;
  /** Messages the provider accepted. */
  pushesSent: number;
  /** Rows stamped delivered, including those with nowhere to send. */
  notificationsMarked: number;
  /** Skipped for being older than MAX_AGE_HOURS. */
  staleSkipped: number;
  /** Device rows removed after the provider reported the token dead. */
  deadTokensRemoved: number;
  sellersWithoutDevices: number;
};

type NotificationRow = {
  id: string;
  seller_id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
};

type DeviceRow = { id: string; seller_id: string; push_token: string };

export async function runPushNotificationsJob(): Promise<PushJobResult> {
  const supabase = createAdminClient();

  const result: PushJobResult = {
    notificationsConsidered: 0,
    pushesSent: 0,
    notificationsMarked: 0,
    staleSkipped: 0,
    deadTokensRemoved: 0,
    sellersWithoutDevices: 0,
  };

  const { data: pending, error: pendingError } = await supabase
    .from('seller_notifications')
    .select('id, seller_id, type, title, message, created_at')
    .is('pushed_at', null)
    // Oldest first: if the cap below truncates the run, the next run picks
    // up where this one stopped rather than leaving the oldest permanently
    // at the back of the queue.
    .order('created_at', { ascending: true })
    .limit(MAX_NOTIFICATIONS_PER_RUN);

  if (pendingError) {
    // An error naming the column is worth explaining precisely, because the
    // generic message sends whoever sees it into this file looking for a
    // bug that isn't here. But there are two different causes, and the
    // fix for each is different:
    //
    // - Postgres itself says the column does not exist (SQLSTATE 42703).
    //   Migration 053 was never applied. Fails every run.
    // - PostgREST says it can't find the column in its schema cache
    //   (PGRST204). The column exists; one API node is still serving a
    //   schema snapshot from before 053 was applied. Comes and goes per
    //   node - which is why cron run #362 and 2026-09-13 13:51 failed
    //   between clean runs. Fix is a cache reload, not a migration.
    //
    // This used to rewrite both as "apply migration 053", which was
    // confidently wrong for the second and cost a real investigation.
    if (/pushed_at/.test(pendingError.message)) {
      const staleCache = pendingError.code === 'PGRST204' || /schema cache/i.test(pendingError.message);
      if (staleCache) {
        throw new Error(
          "seller_notifications.pushed_at is not in the API's schema cache. The column exists, but an API node is serving a stale schema - " +
            "run `notify pgrst, 'reload schema';` in the Supabase SQL editor. This is intermittent by nature; the next run may pass on its own. " +
            '(If migration 053 was genuinely never applied, Postgres reports 42703 instead of this.)',
        );
      }
      throw new Error(
        'seller_notifications.pushed_at is missing - apply migration 053 before enabling push delivery.',
      );
    }
    throw new Error(`Failed to load pending notifications: ${pendingError.message}`);
  }

  const rows = (pending ?? []) as NotificationRow[];
  result.notificationsConsidered = rows.length;
  if (rows.length === 0) return result;

  const staleCutoff = Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000;
  const fresh: NotificationRow[] = [];
  const staleIds: string[] = [];

  for (const row of rows) {
    if (new Date(row.created_at).getTime() < staleCutoff) staleIds.push(row.id);
    else fresh.push(row);
  }
  result.staleSkipped = staleIds.length;

  const { data: deviceData, error: deviceError } = await supabase
    .from('seller_devices')
    .select('id, seller_id, push_token')
    .in('seller_id', [...new Set(fresh.map((r) => r.seller_id))]);

  if (deviceError) throw new Error(`Failed to load devices: ${deviceError.message}`);

  const devicesBySeller = new Map<string, DeviceRow[]>();
  for (const device of (deviceData ?? []) as DeviceRow[]) {
    const list = devicesBySeller.get(device.seller_id) ?? [];
    list.push(device);
    devicesBySeller.set(device.seller_id, list);
  }

  // One message per (notification x device). A seller with a phone and a
  // tablet gets the alert on both, which is what someone who registered
  // two devices is asking for.
  const messages: PushMessage[] = [];
  const deviceIdByToken = new Map<string, string>();
  // Marked even when there is nowhere to send: leaving them null would make
  // every future run reconsider them forever, and would deliver a backlog
  // to whatever device the seller registers next.
  const deliverableIds: string[] = [];

  for (const row of fresh) {
    const devices = devicesBySeller.get(row.seller_id) ?? [];
    if (devices.length === 0) result.sellersWithoutDevices += 1;

    for (const device of devices) {
      deviceIdByToken.set(device.push_token, device.id);
      messages.push({
        to: device.push_token,
        title: row.title,
        body: row.message,
        // What the app needs to deep-link on tap. Kept to ids and a type
        // rather than the whole row - the app refetches, so duplicating
        // content here would just be a second copy to go stale.
        data: { notificationId: row.id, type: row.type },
      });
    }
    deliverableIds.push(row.id);
  }

  const deadTokens = new Set<string>();
  // Batches that never reached the provider. Their notifications stay
  // undelivered so the next run retries, rather than being marked sent on
  // a send that did not happen.
  const failedTokens = new Set<string>();

  for (const batch of chunkForPush(messages)) {
    try {
      const tickets = await sendPushBatch(batch);
      for (const ticket of tickets) {
        if (ticket.status === 'ok') result.pushesSent += 1;
        else if (isDeadTokenTicket(ticket)) deadTokens.add(ticket.token);
      }
    } catch {
      // Transport failure for this batch only - the remaining batches are
      // still attempted, since one provider hiccup should not hold up
      // every other seller's alerts.
      for (const message of batch) failedTokens.add(message.to);
    }
  }

  if (deadTokens.size > 0) {
    const ids = [...deadTokens].map((t) => deviceIdByToken.get(t)).filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      const { error } = await supabase.from('seller_devices').delete().in('id', ids);
      if (!error) result.deadTokensRemoved = ids.length;
    }
  }

  // A notification is only held back if *every* device it targeted failed
  // at the transport level. If it reached one of a seller's two phones,
  // re-sending it to both on the next run would be worse than accepting
  // that one delivery.
  const heldBack = new Set(
    fresh
      .filter((row) => {
        const devices = devicesBySeller.get(row.seller_id) ?? [];
        return devices.length > 0 && devices.every((d) => failedTokens.has(d.push_token));
      })
      .map((row) => row.id),
  );

  const toMark = [...staleIds, ...deliverableIds.filter((id) => !heldBack.has(id))];

  if (toMark.length > 0) {
    const { error } = await supabase
      .from('seller_notifications')
      .update({ pushed_at: new Date().toISOString() })
      .in('id', toMark);

    if (error) throw new Error(`Failed to mark notifications delivered: ${error.message}`);
    result.notificationsMarked = toMark.length;
  }

  return result;
}
