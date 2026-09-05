import { describe, it, expect } from 'vitest';

import { chunkForPush, isDeadTokenTicket, mapPushTickets, PUSH_BATCH_SIZE } from './push';

// The transport's own arithmetic: turning a provider response into one
// outcome per message, and deciding which failures mean a device is dead.
// Both are pure, and both are where a mistake is expensive - a wrong
// "delivered" loses an alert silently, and a wrong "dead token"
// unsubscribes a working phone.

const msg = (to: string) => ({ to, title: 'Low stock', body: '5 units left', data: {} });

describe('mapPushTickets', () => {
  it('aligns tickets to messages positionally', () => {
    const messages = [msg('tok-a'), msg('tok-b')];
    const tickets = mapPushTickets(messages, {
      data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }],
    });

    expect(tickets[0]).toEqual({ token: 'tok-a', status: 'ok' });
    expect(tickets[1].token).toBe('tok-b');
    expect(tickets[1].status).toBe('error');
    expect(tickets[1].errorCode).toBe('DeviceNotRegistered');
  });

  it('treats a short response as unknown rather than success', () => {
    // One ticket returned for two messages. Marking the second delivered
    // on the strength of a response that never mentioned it would lose the
    // notification with nothing to show it went missing.
    const tickets = mapPushTickets([msg('tok-a'), msg('tok-b')], { data: [{ status: 'ok' }] });

    expect(tickets).toHaveLength(2);
    expect(tickets[1].status).toBe('error');
    expect(tickets[1].errorCode).toBe('NoTicket');
  });

  it('treats a missing or malformed data array as unknown for every message', () => {
    expect(mapPushTickets([msg('tok-a')], {})[0].status).toBe('error');
    expect(mapPushTickets([msg('tok-a')], { data: 'nope' })[0].status).toBe('error');
    expect(mapPushTickets([msg('tok-a')], { data: [{ noStatus: true }] })[0].errorCode).toBe('NoTicket');
  });

  it('returns nothing for no messages', () => {
    expect(mapPushTickets([], { data: [] })).toEqual([]);
  });
});

describe('isDeadTokenTicket', () => {
  it('is true only for DeviceNotRegistered', () => {
    expect(isDeadTokenTicket({ token: 't', status: 'error', errorCode: 'DeviceNotRegistered' })).toBe(true);
  });

  it('is false for transient and configuration errors, which say nothing about the device', () => {
    // Deleting a registration because one send was throttled or oversized
    // would silently unsubscribe a phone that works fine.
    for (const code of ['MessageTooBig', 'MessageRateExceeded', 'InvalidCredentials', 'NoTicket']) {
      expect(isDeadTokenTicket({ token: 't', status: 'error', errorCode: code })).toBe(false);
    }
  });

  it('is false for a successful ticket', () => {
    expect(isDeadTokenTicket({ token: 't', status: 'ok' })).toBe(false);
  });
});

describe('chunkForPush', () => {
  it('splits at the provider batch limit', () => {
    const batches = chunkForPush(Array.from({ length: 250 }, (_, i) => i));
    expect(batches.map((b) => b.length)).toEqual([PUSH_BATCH_SIZE, PUSH_BATCH_SIZE, 50]);
  });

  it('returns one batch when it fits, and none when empty', () => {
    expect(chunkForPush([1, 2, 3])).toEqual([[1, 2, 3]]);
    expect(chunkForPush([])).toEqual([]);
  });
});
