import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Same cookie pattern middleware.ts matches on - see the comment there for
// why this is a redirect-UX/dev-bypass signal, not the security boundary.
const SUPABASE_AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

const AUTH_BYPASSED = process.env.BYPASS_AUTH === '1';

// Dev-only: BYPASS_AUTH=1 with no real session hands out a service-role
// client (bypasses RLS) instead of an anon+cookie client, so pages/routes
// keep working while Clerk isn't wired up yet. getCurrentSeller() then
// falls back to the first `sellers` row. Remove once real auth lands.
export async function isBypassedNoSession(): Promise<boolean> {
  if (!AUTH_BYPASSED) return false;
  const cookieStore = await cookies();
  return !cookieStore.getAll().some((c) => SUPABASE_AUTH_COOKIE.test(c.name));
}

function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
  if (await isBypassedNoSession()) {
    return createServiceRoleClient();
  }

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
