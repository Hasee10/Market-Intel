'use client';

import { useEffect } from 'react';

import { MdErrorOutline, MdRefresh } from 'react-icons/md';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { reportError } from '@/lib/observability/report-error';

// Shared body for every error.tsx in the app. Those files have to be
// per-segment (that's the file convention - a segment without one falls
// through to its parent), but the UI they show shouldn't be copy-pasted five
// times, so each one is a two-line wrapper around this.
//
// Before this existed there were no error boundaries anywhere in src/app: an
// uncaught render error meant a blank white page with nothing logged and no
// way back except a manual reload. That got worse when the dashboard pages
// became Server Components, since a throw during a server render takes the
// whole route rather than one widget.
//
// The user is never shown `error.message`. In production Next already
// replaces server-side messages with a digest, but client-side errors keep
// their real text - and that text can carry Postgres detail (table and
// column names) straight to the screen. The real error goes to the log
// instead; the digest is shown so a support conversation can match a screen
// to a log line.

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  scope: string;
  title?: string;
};

export function RouteError({ error, reset, scope, title = 'Something went wrong' }: RouteErrorProps) {
  useEffect(() => {
    reportError(error, { scope, meta: { digest: error.digest } });
  }, [error, scope]);

  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <MdErrorOutline className="size-8 text-error-500" aria-hidden="true" />
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{title}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            This page didn&apos;t load. It&apos;s been logged - trying again often clears it.
          </p>
        </div>

        <Button className="mt-1" leftIcon={<MdRefresh className="size-4" />} onClick={reset}>
          Try again
        </Button>

        {error.digest && (
          <p className="mt-1 font-mono text-xs text-gray-400 dark:text-gray-600">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </Card>
  );
}

export default RouteError;
