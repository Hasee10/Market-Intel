import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

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
