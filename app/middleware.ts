import { NextResponse, type NextRequest } from 'next/server';

import { checkCrossSite } from '@/lib/csrf';

const PROTECTED_PREFIXES = ['/dashboard', '/apps', '/onboarding'];
const AUTH_PREFIX = '/auth';

// Supabase stores its session as `sb-<project-ref>-auth-token`, optionally
// chunked into `.0`, `.1`, ... when the JWT exceeds the 4KB cookie limit.
const SUPABASE_AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

// Deliberately dependency-free: this file has to bundle standalone as the
// middleware entrypoint. Importing @supabase/ssr here pulled a Node-only
// dependency graph into the middleware bundle, which Next 16 + Turbopack
// mis-compiled - every request died with MIDDLEWARE_INVOCATION_FAILED.
//
// runtime: 'nodejs' below (not Edge): Next 16's own vendored
// @opentelemetry/api bundle references __dirname unconditionally, which
// Vercel's Edge isolate doesn't define, crashing every request regardless of
// what this file imports. The Node.js runtime doesn't hit that path.
//
// This is a redirect-UX gate, not a security boundary. Real identity is
// verified server-side via createClient().auth.getUser() in pages and route
// handlers, where RLS is enforced - requireSeller() in lib/market-intel/
// seller.ts is the guard every protected layout actually depends on.
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cross-site check on cookie-authenticated API mutations - leaks.md
  // finding #11. Runs before anything else so a forged request never
  // reaches a handler. See lib/csrf.ts for the rule and its exemptions;
  // in short: Bearer-authenticated requests (mobile, cron) are untouched.
  if (pathname.startsWith('/api/')) {
    const verdict = checkCrossSite(request);
    if (verdict.blocked) {
      return NextResponse.json(
        {
          succeeded: false,
          data: null,
          errors: ['Cross-site request refused'],
          message: 'Cross-site request refused',
        },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  const hasSession = request.cookies
    .getAll()
    .some((cookie) => SUPABASE_AUTH_COOKIE.test(cookie.name));

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = pathname.startsWith(AUTH_PREFIX);

  if (!hasSession && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/signin';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard/overview';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
  runtime: 'nodejs',
};
