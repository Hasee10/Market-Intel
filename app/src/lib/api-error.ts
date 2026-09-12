'server-only';

import { NextResponse } from 'next/server';

import { reportError } from '@/lib/observability/report-error';

// One way for a route handler to fail.
//
// Handlers were returning the underlying error's own text to the client -
// `errors: [error.message]` where `error` came straight from Supabase. A
// Postgres error message names tables, columns and constraints ('duplicate
// key value violates unique constraint "seller_products_sku_key"'), so this
// was quietly publishing the schema to anyone who could provoke a failure,
// and in a few places rendering it into an on-screen alert. That is
// SECURITY.md finding #12.
//
// The detail is not lost, it moves: reportError() puts the real error in the
// log where triage needs it, and the caller gets the handler's own
// already-written summary ('Failed to update product'), which is what the UI
// was showing as the headline anyway.
//
// Deliberately not for validation failures. A Zod message describes what the
// *caller* sent wrong and is useful to them - parseJsonBody() keeps
// returning those verbatim, and should.
export function apiError(
  error: unknown,
  message: string,
  status: number,
  scope: string,
): NextResponse {
  reportError(error, { scope, meta: { status } });

  return NextResponse.json(
    { succeeded: false, data: null, errors: [message], message },
    { status },
  );
}

// The exception, for /api/cron/* only.
//
// Those six handlers are reachable solely with CRON_SECRET (checked by
// isAuthorizedCronRequest before anything else runs), and the only caller
// is our own GitHub Actions workflow, which prints the response body into
// the run log. Hiding the underlying error there protects no one - there is
// no untrusted reader - and it removes the one line an operator needs when
// a scheduled run goes red. It did exactly that on the first failure after
// apiError() landed: the run said "Failed to run push notifications job"
// and nothing else, where before it would have named the query.
//
// So this restores that route's original response contract - the real
// message in `errors`, the summary in `message` - while keeping the log
// line apiError() added. It must not be used from any handler a browser
// can reach; that is what apiError() is for.
export function cronError(
  error: unknown,
  message: string,
  scope: string,
): NextResponse {
  reportError(error, { scope, meta: { status: 500 } });

  return NextResponse.json(
    {
      succeeded: false,
      data: null,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      message,
    },
    { status: 500 },
  );
}
