import { timingSafeEqual } from 'crypto';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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

// Server Components/Actions/Route Handlers client. Reads/writes the auth
// cookie via Next's cookies() so RLS policies (auth.uid()) see the right
// user. The set() calls are wrapped in try/catch because Server Components
// can't write cookies - only Server Actions and Route Handlers can. When
// called from a Server Component this silently no-ops and relies on
// middleware.ts to keep the session cookie fresh instead.
export async function createClient() {
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
