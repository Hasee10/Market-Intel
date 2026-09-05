'server-only';

// Push transport.
//
// Expo's push service, because the mobile app is React Native and this is
// the one option that reaches iOS and Android through a single HTTPS call
// with no APNs certificate to rotate and no FCM service-account JSON to
// keep in an environment variable. The tokens the app registers
// (seller_devices.push_token, migration 052) are Expo push tokens.
//
// Everything provider-specific is in this file on purpose. Moving to raw
// FCM/APNs later means reimplementing sendPushBatch and mapPushTickets and
// changing nothing in the job that calls them - which is the whole reason
// the job talks to this seam rather than to an HTTP endpoint directly.
//
// EXPO_ACCESS_TOKEN is optional. Expo accepts unauthenticated sends, but
// with the token set only your account can push to your tokens, so it is
// worth having in production. The job runs either way rather than refusing
// to start, since an unset variable should not silently stop alerts.

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/** Expo caps a single request at 100 messages. */
export const PUSH_BATCH_SIZE = 100;

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  /** Round-tripped by the provider so the app can deep-link on tap. */
  data: Record<string, unknown>;
};

export type PushTicket = {
  token: string;
  status: 'ok' | 'error';
  /** Expo's machine-readable reason, e.g. DeviceNotRegistered. */
  errorCode?: string;
  message?: string;
};

/**
 * Sends one batch (<= PUSH_BATCH_SIZE) and returns a ticket per message,
 * positionally aligned with the input.
 *
 * Never throws for a per-message failure - a single dead token must not
 * fail the other 99 in the batch. A transport-level failure (network,
 * non-200) does throw, because that is not a per-device problem and the
 * caller needs to know the batch never landed so it can leave those
 * notifications undelivered rather than marking them sent.
 */
export async function sendPushBatch(messages: PushMessage[]): Promise<PushTicket[]> {
  if (messages.length === 0) return [];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    // Expo compresses large responses; being explicit avoids a surprise
    // when a batch of 100 tickets comes back gzipped.
    'Accept-Encoding': 'gzip, deflate',
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Push provider returned ${response.status}`);
  }

  const payload = (await response.json()) as { data?: unknown; errors?: unknown };
  return mapPushTickets(messages, payload);
}

/**
 * Turns the provider's response into one ticket per input message.
 *
 * Split out from the fetch so the mapping - which is where the fiddly
 * cases live - is testable without a network call.
 *
 * Expo returns a `data` array positionally aligned with the request. A
 * malformed or short response is treated as "unknown outcome" for the
 * affected messages rather than as success: marking a notification
 * delivered on a response we could not read would lose it silently, and a
 * duplicate push is a far cheaper mistake than a missing one.
 */
export function mapPushTickets(
  messages: PushMessage[],
  payload: { data?: unknown; errors?: unknown },
): PushTicket[] {
  const tickets = Array.isArray(payload.data) ? payload.data : [];

  return messages.map((message, i) => {
    const ticket = tickets[i] as
      | { status?: string; message?: string; details?: { error?: string } }
      | undefined;

    if (!ticket || typeof ticket.status !== 'string') {
      return { token: message.to, status: 'error', errorCode: 'NoTicket' };
    }

    if (ticket.status === 'ok') {
      return { token: message.to, status: 'ok' };
    }

    return {
      token: message.to,
      status: 'error',
      errorCode: ticket.details?.error,
      message: ticket.message,
    };
  });
}

/**
 * Whether a ticket means the token is permanently dead and its row should
 * be deleted.
 *
 * Only DeviceNotRegistered qualifies. The other Expo error codes are
 * transient or configuration problems - MessageTooBig and
 * MessageRateExceeded say nothing about the device, and deleting a
 * registration because one send was throttled would silently unsubscribe
 * a working phone.
 */
export function isDeadTokenTicket(ticket: PushTicket): boolean {
  return ticket.status === 'error' && ticket.errorCode === 'DeviceNotRegistered';
}

/** Splits a list into provider-sized batches. */
export function chunkForPush<T>(items: T[], size = PUSH_BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
