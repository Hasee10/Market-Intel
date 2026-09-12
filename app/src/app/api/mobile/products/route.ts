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

// The seller's catalogue, trimmed for a phone.
//
// Deliberately fewer fields than /api/products: no cost price, no SKU, no
// category joins. A phone list shows a photo, a name, a price and whether
// stock is low - everything else is weight on a mobile connection, and the
// full record is one tap away on the desktop.
//
// Cursor is keyed on created_at for the same reason the alert feed is:
// offsets shift under insertion, and a seller adding a product mid-scroll
// would otherwise see a duplicate row.

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

  const search = (request.nextUrl.searchParams.get('q') ?? '').trim();

  const supabase = createBearerClient(token);

  let query = supabase
    .from('seller_products')
    .select('id, title, sell_price, currency, stock_qty, is_active, image_url, created_at')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false })
    .limit(MOBILE_PAGE_SIZE + 1);

  if (cursor) query = query.lt('created_at', cursor);
  // ilike, not full-text: this is a "find the one I'm holding" box over a
  // seller's own catalogue of hundreds, not a search engine over millions.
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error } = await query;
  if (error) return mobileError('Could not load products', 500);

  const rows = data ?? [];
  const hasMore = rows.length > MOBILE_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, MOBILE_PAGE_SIZE) : rows;

  return mobileOk({
    products: page.map((p) => ({
      id: p.id,
      title: p.title,
      price: p.sell_price != null ? Number(p.sell_price) : null,
      // Carried per row rather than assumed from the seller record: a
      // catalogue can legitimately mix currencies, and a client that
      // assumes one will mislabel the others.
      currency: p.currency ?? seller.reportingCurrency,
      stockQty: p.stock_qty,
      isActive: p.is_active,
      imageUrl: p.image_url ?? null,
    })),
    nextCursor: hasMore ? encodeCursor(page[page.length - 1].created_at) : null,
  });
}
