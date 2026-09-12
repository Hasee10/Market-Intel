import 'server-only';

import { NextResponse } from 'next/server';

import { hasFeature, type Feature } from '@/lib/market-intel/core/entitlements';
import { getSellerFromRequest, type Seller } from '@/lib/market-intel/seller/seller';

// Shared plumbing for /api/mobile/*.
//
// Every route here does the same three things before it does anything
// useful: resolve the seller from a bearer token, check the plan tier, and
// answer in one envelope. Doing that in one place is what stops eight
// handlers from each inventing their own 401 shape - which is exactly the
// kind of drift that makes a client-side error handler grow special cases.
//
// The envelope deliberately matches the rest of the app
// ({ succeeded, data, errors, message }) rather than inventing a leaner
// mobile-only shape. A single response contract across every endpoint is
// worth more to the client developer than the handful of bytes a bespoke
// one would save.

export type MobileResponse<T> = {
  succeeded: boolean;
  data: T | null;
  errors: string[];
  message: string;
};

export function mobileOk<T>(data: T, message = 'OK'): NextResponse {
  return NextResponse.json({ succeeded: true, data, errors: [], message });
}

export function mobileError(message: string, status: number, errors?: string[]): NextResponse {
  return NextResponse.json(
    { succeeded: false, data: null, errors: errors ?? [message], message },
    { status },
  );
}

/**
 * Resolves the seller for a mobile request, optionally requiring a plan
 * feature.
 *
 * Returns either the seller or a ready-to-return error response, so a
 * handler reads as:
 *
 *   const auth = await requireMobileSeller(request);
 *   if ('response' in auth) return auth.response;
 *   const { seller } = auth;
 *
 * The discriminated union is on purpose - a nullable return would let a
 * handler forget the check and carry on with `seller` undefined, and an
 * exception would need a try/catch in every route to produce the same JSON.
 *
 * The entitlement check lives here rather than in each handler because the
 * mobile app must gate on exactly the same tiers the desktop does. A
 * feature reachable from a phone but not a browser would be a paywall hole,
 * not a mobile feature.
 */
export async function requireMobileSeller(
  request: Request,
  feature?: Feature,
): Promise<{ seller: Seller } | { response: NextResponse }> {
  const seller = await getSellerFromRequest(request);

  if (!seller) {
    return {
      response: mobileError('Not authenticated', 401, [
        'Send the Supabase session access token as: Authorization: Bearer <token>',
      ]),
    };
  }

  if (feature && !hasFeature(seller.planTier as never, feature)) {
    return {
      response: mobileError('Upgrade required', 403, [
        `Your plan does not include ${feature.replace(/_/g, ' ')}.`,
      ]),
    };
  }

  return { seller };
}

// Page size for every cursor-paginated mobile list. One number, because a
// client that has to remember a different limit per endpoint will get one
// of them wrong.
export const MOBILE_PAGE_SIZE = 20;

/**
 * Opaque cursor over a created-at style ISO timestamp.
 *
 * Base64 rather than a raw timestamp so it reads as a token the client
 * should pass back untouched rather than a value worth constructing by
 * hand - the encoding is not a security boundary and is not treated as one.
 */
export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | null): string | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    // A cursor that isn't a real timestamp would silently return the whole
    // list from the beginning, which reads as a pagination bug rather than
    // a bad request. Fail closed instead.
    return Number.isNaN(Date.parse(decoded)) ? null : decoded;
  } catch {
    return null;
  }
}
