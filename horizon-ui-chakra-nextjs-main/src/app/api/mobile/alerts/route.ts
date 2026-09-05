import { NextRequest } from 'next/server';

import { createBearerClient, getBearerToken } from '@/lib/supabase/server';
import {
  MOBILE_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  mobileError,
  mobileOk,
  requireMobileSeller,
} from '@/lib/mobile/respond';

// The alert feed, cursor-paginated.
//
// Cursor rather than page numbers, and not just for taste: a phone list
// appends as you scroll, and the feed grows from the top as the cron jobs
// write new alerts. With offsets, a new alert arriving between two page
// fetches shifts every subsequent row down by one and the reader sees a
// duplicate. A created_at cursor is stable under insertion.
//
// listNotifications() is not reused here because it takes a plain limit and
// has no cursor - adding one to it would change a function the desktop
// notifications bell and the Watchlist page both depend on. This queries
// the same table under the same RLS instead.

export async function GET(request: NextRequest) {
  const auth = await requireMobileSeller(request);
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  const token = getBearerToken(request);
  if (!token) return mobileError('Not authenticated', 401);

  const rawCursor = request.nextUrl.searchParams.get('cursor');
  const cursor = decodeCursor(rawCursor);
  if (rawCursor && !cursor) {
    return mobileError('Invalid cursor', 400, [
      'Pass back the nextCursor value from a previous response, unmodified.',
    ]);
  }

  const supabase = createBearerClient(token);

  let query = supabase
    .from('seller_notifications')
    .select('id, type, title, message, is_read, created_at')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false })
    // One extra row, to tell "this is the last page" from "there is more"
    // without a second count query.
    .limit(MOBILE_PAGE_SIZE + 1);

  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) {
    return mobileError('Could not load alerts', 500);
  }

  const rows = data ?? [];
  const hasMore = rows.length > MOBILE_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, MOBILE_PAGE_SIZE) : rows;

  return mobileOk({
    alerts: page.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.is_read,
      createdAt: n.created_at,
    })),
    nextCursor: hasMore ? encodeCursor(page[page.length - 1].created_at) : null,
  });
}
