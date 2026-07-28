import type { NextRequest } from 'next/server';

import { updateSession } from './src/lib/supabase/middleware';

export default function middleware(req: NextRequest) {
  return updateSession(req);
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
