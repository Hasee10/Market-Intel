import { createBearerClient, getBearerToken } from '@/lib/supabase/server';
import { mobileError, mobileOk, requireMobileSeller } from '@/lib/mobile/respond';

// The one write worth having on a phone.
//
// A single field, deliberately. Full catalogue editing stays on the
// desktop: a form with eight fields half-submitted over a dropping mobile
// connection is a worse outcome than not offering it. One field either
// lands or it doesn't.
//
// This is the action the rest of the app builds toward - a seller sees a
// competitor undercut them in the alert feed, opens the product, and
// changes the price without going back to a laptop.

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileSeller(request);
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  const { id } = await params;

  let body: { price?: unknown };
  try {
    body = await request.json();
  } catch {
    return mobileError('Invalid JSON body', 400);
  }

  const price = Number(body.price);

  if (!Number.isFinite(price) || price < 0) {
    return mobileError('A valid price is required', 400, [
      'Send { "price": 1999 } - a non-negative number.',
    ]);
  }

  const token = getBearerToken(request);
  if (!token) return mobileError('Not authenticated', 401);

  // seller_id in the filter as well as RLS, and .select() after the update
  // so a write that matched nothing is distinguishable from one that
  // succeeded. Without it, updating someone else's product id would return
  // a cheerful 200 having changed nothing.
  const { data, error } = await createBearerClient(token)
    .from('seller_products')
    .update({ sell_price: price })
    .eq('id', id)
    .eq('seller_id', seller.id)
    .select('id, title, sell_price, currency')
    .maybeSingle();

  if (error) return mobileError('Could not update the price', 500);
  if (!data) return mobileError('Product not found', 404);

  return mobileOk(
    {
      id: data.id,
      title: data.title,
      price: data.sell_price != null ? Number(data.sell_price) : null,
      currency: data.currency ?? seller.reportingCurrency,
    },
    'Price updated',
  );
}
