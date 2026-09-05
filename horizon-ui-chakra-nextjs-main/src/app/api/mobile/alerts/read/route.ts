import { markAllNotificationsRead } from '@/lib/notifications/list';
import { createBearerClient, getBearerToken } from '@/lib/supabase/server';
import { mobileError, mobileOk, requireMobileSeller } from '@/lib/mobile/respond';

// Marks alerts read - one, several, or all.
//
// Takes an array rather than a single id so a swipe-to-clear gesture over
// several rows costs one request instead of one per row, which on a phone
// connection is the difference between instant and visibly laggy.
//
// { all: true } is a separate flag rather than an empty array meaning "all":
// an empty array is what a buggy client sends by accident, and having that
// silently clear the entire feed is not a failure mode worth allowing.

const MAX_IDS_PER_CALL = 100;

export async function POST(request: Request) {
  const auth = await requireMobileSeller(request);
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  let body: { ids?: unknown; all?: unknown };
  try {
    body = await request.json();
  } catch {
    return mobileError('Invalid JSON body', 400);
  }

  if (body.all === true) {
    await markAllNotificationsRead(seller.id);
    return mobileOk({ markedAll: true }, 'All alerts marked read');
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];

  if (ids.length === 0) {
    return mobileError('Nothing to mark', 400, [
      'Send { "ids": ["..."] } for specific alerts, or { "all": true } to clear the feed.',
    ]);
  }

  if (ids.length > MAX_IDS_PER_CALL) {
    return mobileError('Too many alerts in one call', 400, [
      `Send at most ${MAX_IDS_PER_CALL} ids per request.`,
    ]);
  }

  const token = getBearerToken(request);
  if (!token) return mobileError('Not authenticated', 401);

  // seller_id is filtered explicitly even though RLS already scopes this to
  // the caller. The policy is the guarantee; this is the second lock, and
  // it costs one predicate.
  const { error } = await createBearerClient(token)
    .from('seller_notifications')
    .update({ is_read: true })
    .eq('seller_id', seller.id)
    .in('id', ids);

  if (error) return mobileError('Could not mark alerts read', 500);

  return mobileOk({ markedCount: ids.length }, 'Alerts marked read');
}
