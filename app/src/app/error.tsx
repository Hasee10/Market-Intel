'use client';

import { RouteError } from '@/components/ui/RouteError';

// Catch-all for segments without their own error.tsx - onboarding, auth, and
// the public marketing pages. apps/ and dashboard/ have their own so they can
// keep the shell; this one replaces the page body.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <RouteError error={error} reset={reset} scope="root" />
    </div>
  );
}
