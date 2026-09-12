import { describe, it, expect, vi, beforeEach } from 'vitest';

// The job's decisions, which are the expensive ones to get wrong: what gets
// sent, what gets marked delivered, and what is deliberately held back so a
// later run retries it.

let notificationRows: any[] = [];
let deviceRows: any[] = [];
let markedIds: string[] = [];
let deletedDeviceIds: string[] = [];
/** Batches handed to the transport, so tests can assert on fan-out. */
let sentBatches: any[][] = [];
/** Tokens whose batch should throw, simulating a transport failure. */
let failingTokens = new Set<string>();
/** Tokens the provider reports as permanently dead. */
let deadTokens = new Set<string>();
/** Tokens that get a per-message ticket error that is NOT a dead device. */
let softErrorTokens = new Set<string>();
/** Forces the pending-notification select to fail, for the migration guard. */
let selectError: { message: string } | null = null;

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'seller_notifications') {
        return {
          select: () => ({
            is: () => ({
              order: () => ({
                limit: async () => ({ data: selectError ? null : notificationRows, error: selectError }),
              }),
            }),
          }),
          update: () => ({
            in: async (_col: string, ids: string[]) => {
              markedIds = ids;
              return { error: null as unknown };
            },
          }),
        };
      }
      if (table === 'seller_devices') {
        return {
          select: () => ({
            in: async () => ({ data: deviceRows, error: null as unknown }),
          }),
          delete: () => ({
            in: async (_col: string, ids: string[]) => {
              deletedDeviceIds = ids;
              return { error: null as unknown };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock('@/lib/notifications/push', async () => {
  const actual = await vi.importActual<typeof import('@/lib/notifications/push')>(
    '@/lib/notifications/push',
  );
  return {
    ...actual,
    sendPushBatch: async (batch: any[]) => {
      sentBatches.push(batch);
      if (batch.some((m) => failingTokens.has(m.to))) throw new Error('transport down');
      return batch.map((m) => {
        if (deadTokens.has(m.to)) {
          return { token: m.to, status: 'error', errorCode: 'DeviceNotRegistered' };
        }
        if (softErrorTokens.has(m.to)) {
          return { token: m.to, status: 'error', errorCode: 'MessageTooBig' };
        }
        return { token: m.to, status: 'ok' };
      });
    },
  };
});

import { runPushNotificationsJob } from './push-notifications-job';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function notification(id: string, sellerId: string, createdAt = hoursAgo(1)) {
  return {
    id,
    seller_id: sellerId,
    type: 'low_stock',
    title: 'Low stock',
    message: '5 units left',
    created_at: createdAt,
  };
}

beforeEach(() => {
  notificationRows = [];
  deviceRows = [];
  markedIds = [];
  deletedDeviceIds = [];
  sentBatches = [];
  failingTokens = new Set();
  deadTokens = new Set();
  softErrorTokens = new Set();
  selectError = null;
});

describe('runPushNotificationsJob', () => {
  it('does nothing when there is nothing pending', async () => {
    const result = await runPushNotificationsJob();
    expect(result.notificationsConsidered).toBe(0);
    expect(sentBatches).toEqual([]);
    expect(markedIds).toEqual([]);
  });

  it('sends one message per device and marks the notification delivered', async () => {
    notificationRows = [notification('n1', 's1')];
    deviceRows = [
      { id: 'd1', seller_id: 's1', push_token: 'tok-phone' },
      { id: 'd2', seller_id: 's1', push_token: 'tok-tablet' },
    ];

    const result = await runPushNotificationsJob();

    // A seller who registered two devices asked for it on both.
    expect(sentBatches.flat().map((m) => m.to).sort()).toEqual(['tok-phone', 'tok-tablet']);
    expect(result.pushesSent).toBe(2);
    expect(markedIds).toEqual(['n1']);
  });

  it('carries the notification id in the payload so the app can deep-link', async () => {
    notificationRows = [notification('n1', 's1')];
    deviceRows = [{ id: 'd1', seller_id: 's1', push_token: 'tok' }];

    await runPushNotificationsJob();

    expect(sentBatches.flat()[0].data).toEqual({ notificationId: 'n1', type: 'low_stock' });
  });

  it('marks notifications delivered even when the seller has no device', async () => {
    // Otherwise every future run reconsiders them forever, and whatever
    // device the seller registers next receives the entire backlog.
    notificationRows = [notification('n1', 's1')];
    deviceRows = [];

    const result = await runPushNotificationsJob();

    expect(sentBatches).toEqual([]);
    expect(result.sellersWithoutDevices).toBe(1);
    expect(markedIds).toEqual(['n1']);
  });

  it('skips stale notifications without sending, but still marks them', async () => {
    // A job that was broken for a week must not dump the week onto a phone
    // the moment it recovers.
    notificationRows = [notification('old', 's1', hoursAgo(48)), notification('new', 's1')];
    deviceRows = [{ id: 'd1', seller_id: 's1', push_token: 'tok' }];

    const result = await runPushNotificationsJob();

    expect(result.staleSkipped).toBe(1);
    expect(sentBatches.flat().map((m) => m.data.notificationId)).toEqual(['new']);
    expect(markedIds.sort()).toEqual(['new', 'old']);
  });

  it('deletes a device the provider reports as permanently unregistered', async () => {
    notificationRows = [notification('n1', 's1')];
    deviceRows = [{ id: 'd-dead', seller_id: 's1', push_token: 'tok-dead' }];
    deadTokens = new Set(['tok-dead']);

    const result = await runPushNotificationsJob();

    expect(deletedDeviceIds).toEqual(['d-dead']);
    expect(result.deadTokensRemoved).toBe(1);
    // Still marked: the notification was processed, the device was simply gone.
    expect(markedIds).toEqual(['n1']);
  });

  it('holds a notification back when every one of its devices failed at transport level', async () => {
    // Not marked, so the next run retries it rather than losing it.
    notificationRows = [notification('n1', 's1')];
    deviceRows = [{ id: 'd1', seller_id: 's1', push_token: 'tok-broken' }];
    failingTokens = new Set(['tok-broken']);

    const result = await runPushNotificationsJob();

    expect(markedIds).toEqual([]);
    expect(result.notificationsMarked).toBe(0);
  });

  it('still marks a notification when a device fails for a non-device reason', async () => {
    // A per-message ticket error is not a transport failure: the request
    // reached the provider, so the batch is not retried. Only a dead-device
    // ticket removes a registration, and a soft error like MessageTooBig
    // must not hold the notification back forever.
    notificationRows = [notification('n1', 's1')];
    deviceRows = [
      { id: 'd1', seller_id: 's1', push_token: 'tok-ok' },
      { id: 'd2', seller_id: 's1', push_token: 'tok-soft' },
    ];
    softErrorTokens = new Set(['tok-soft']);

    const result = await runPushNotificationsJob();

    expect(markedIds).toEqual(['n1']);
    expect(deletedDeviceIds).toEqual([]);
    expect(result.pushesSent).toBe(1);
  });

  it('holds back everything in a batch the provider never received', async () => {
    // A thrown send means the HTTP request itself failed, so nothing in
    // that batch arrived - including other sellers' messages that happened
    // to share it. Marking any of them delivered would lose an alert; they
    // are all left for the next run instead.
    notificationRows = [notification('n1', 's1'), notification('n2', 's2')];
    deviceRows = [
      { id: 'd1', seller_id: 's1', push_token: 'tok-broken' },
      { id: 'd2', seller_id: 's2', push_token: 'tok-ok' },
    ];
    failingTokens = new Set(['tok-broken']);

    const result = await runPushNotificationsJob();

    expect(markedIds).toEqual([]);
    expect(result.pushesSent).toBe(0);
  });

  it('names the missing migration rather than surfacing a raw Postgres error', async () => {
    // Whoever sees this failure should be sent to the migration list, not
    // into the job's source looking for a bug that isn't there.
    selectError = { message: 'column seller_notifications.pushed_at does not exist' };

    await expect(runPushNotificationsJob()).rejects.toThrow(/migration 053/);
  });

  it('surfaces any other query failure as-is rather than blaming the migration', async () => {
    selectError = { message: 'connection terminated unexpectedly' };

    await expect(runPushNotificationsJob()).rejects.toThrow(/connection terminated/);
  });
});
