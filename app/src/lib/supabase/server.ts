import { timingSafeEqual } from 'crypto';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// For cron/route handlers that run with no user session at all (the
// benchmarks aggregation job, the price-alerts diff job) and need to bypass
// RLS by design - domain_benchmarks/seller_notifications/seller_price_alerts
// are only ever written by the service role, never by an authenticated
// seller. Callers must gate access themselves (see requireCronAuth below).
export function createAdminClient() {
  return createServiceRoleClient();
}

// Shared guard for cron-triggered route handlers: requires a
// `Authorization: Bearer <CRON_SECRET>` header so these endpoints can't be
// hit by anyone who finds the URL. Returns true if the request is authorized.
// timingSafeEqual rather than ===: string equality short-circuits at the
// first differing byte, leaking the shared secret one character at a time
// to anyone able to measure response latency across many requests
// (leaks.md finding #9). Length is checked separately because
// timingSafeEqual throws on mismatched lengths - that comparison isn't
// constant-time, but it only reveals how long the secret is, not its value.
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization');
  if (!header) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}

// Bearer-token client, for the mobile API (/api/mobile/*).
//
// createClient() below resolves the session exclusively from Next's
// cookies(), which is correct for the web app and unusable from a native
// one: a phone authenticates with Supabase's own mobile SDK and holds the
// JWT itself, sending it as `Authorization: Bearer <token>`. That header is
// invisible to the cookie helper, so every existing route reads as
// unauthenticated when called from the app.
//
// This is the same anon key and the same JWT the browser would carry - only
// the place it is read from differs - so RLS behaves identically. Nothing
// here weakens the boundary: an absent or invalid token yields a client
// whose auth.getUser() returns null, exactly as a missing cookie does.
//
// Deliberately a separate function rather than a branch inside
// createClient(): the desktop path is the one thing that must not change
// behaviour, and the surest way to guarantee that is to not touch it.
export function createBearerClient(accessToken: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    },
  );
}

/**
 * Pulls the bearer token out of a request's Authorization header.
 * Returns null when the header is absent or isn't a Bearer scheme, so
 * callers can fail closed without special-casing the shape.
 */
export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;

  const [scheme, ...rest] = header.split(' ');
  if (scheme.toLowerCase() !== 'bearer') return null;

  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}

// Anonymous public-data client - no cookies, no session, just the anon key.
// For reads that are meant to work identically for every visitor regardless
// of whether they're signed in (the marketing homepage's company/brand
// showcase - see lib/market-intel/showcase.ts). Deliberately not
// createClient(): that one wires in cookies() so it can resolve auth.uid(),
// which forces the calling route into fully dynamic (per-request) rendering
// even when nothing about the query is actually user-specific.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

// headers() is only available inside a request. Outside one it throws;
// createClient() must keep behaving exactly as before in that case, so
// this reads it as "no headers" rather than letting the throw escape.
async function headersOrNull(): Promise<Request> {
  try {
    const h = await headers();
    return new Request('http://local', { headers: h });
  } catch {
    return new Request('http://local');
  }
}

// Server Components/Actions/Route Handlers client. Reads/writes the auth
// cookie via Next's cookies() so RLS policies (auth.uid()) see the right
// user. The set() calls are wrapped in try/catch because Server Components
// can't write cookies - only Server Actions and Route Handlers can. When
// called from a Server Component this silently no-ops and relies on
// middleware.ts to keep the session cookie fresh instead.
//
// Bearer-aware. A mobile request carries its session as
// `Authorization: Bearer <token>` and no cookie at all. Before this check,
// every lib function that opened this client from a mobile route ran with
// no user: auth.uid() was null, every seller-scoped RLS policy filtered
// every row, and the function returned [] with no error - which the first
// real mobile client reported as "the API returns an empty list" on an
// account with plenty of data. The four original mobile routes that query
// directly already used createBearerClient(); the ones built on shared lib
// functions did not, because the lib functions choose the client
// themselves. Resolving it here, once, is what makes those functions
// safe to share between the web and the phone at all.
//
// Only a Bearer scheme triggers it, and only on the request path where
// headers() is available. The cron workflow also sends a Bearer header
// (CRON_SECRET), but cron jobs run on createAdminClient() and never reach
// this function - verified at the time of writing; see the jobs' imports.
export async function createClient() {
  const bearer = getBearerToken(await headersOrNull());
  if (bearer) return createBearerClient(bearer);

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component - middleware refreshes the
            // session instead.
          }
        },
      },
    },
  );
}
