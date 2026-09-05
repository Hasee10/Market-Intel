import { createBearerClient, getBearerToken } from '@/lib/supabase/server';
import { mobileError, mobileOk, requireMobileSeller } from '@/lib/mobile/respond';

// Registers a device to receive push notifications, and de-registers it on
// sign-out.
//
// Requires migration 052. The alert data this delivers has existed since
// 014 - the low-stock and price-alert crons write it daily - so this is the
// last piece between that feed and a notification on a phone, not the
// start of a new pipeline.
//
// Upsert on the token rather than insert: an app that re-registers on every
// launch (which is the sane thing for a client to do, since tokens rotate)
// must not accumulate a row per launch.

const VALID_PLATFORMS = new Set(['ios', 'android']);

export async function POST(request: Request) {
  const auth = await requireMobileSeller(request);
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  let body: { pushToken?: unknown; platform?: unknown; appVersion?: unknown };
  try {
    body = await request.json();
  } catch {
    return mobileError('Invalid JSON body', 400);
  }

  const pushToken = typeof body.pushToken === 'string' ? body.pushToken.trim() : '';
  const platform = typeof body.platform === 'string' ? body.platform.toLowerCase() : '';
  const appVersion = typeof body.appVersion === 'string' ? body.appVersion.slice(0, 32) : null;

  if (!pushToken) {
    return mobileError('A push token is required', 400, [
      'Send { "pushToken": "...", "platform": "ios" | "android" }.',
    ]);
  }

  if (!VALID_PLATFORMS.has(platform)) {
    return mobileError('Platform must be ios or android', 400);
  }

  const token = getBearerToken(request);
  if (!token) return mobileError('Not authenticated', 401);

  const { error } = await createBearerClient(token)
    .from('seller_devices')
    .upsert(
      {
        seller_id: seller.id,
        push_token: pushToken,
        platform,
        app_version: appVersion,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'push_token' },
    );

  if (error) return mobileError('Could not register this device', 500);

  return mobileOk({ registered: true }, 'Device registered');
}

// Called on sign-out. Without it, a shared or resold handset keeps
// receiving another seller's alerts until the token happens to rotate.
export async function DELETE(request: Request) {
  const auth = await requireMobileSeller(request);
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  let body: { pushToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return mobileError('Invalid JSON body', 400);
  }

  const pushToken = typeof body.pushToken === 'string' ? body.pushToken.trim() : '';
  if (!pushToken) return mobileError('A push token is required', 400);

  const { error } = await createBearerClient(getBearerToken(request)!)
    .from('seller_devices')
    .delete()
    .eq('seller_id', seller.id)
    .eq('push_token', pushToken);

  if (error) return mobileError('Could not remove this device', 500);

  return mobileOk({ removed: true }, 'Device removed');
}
