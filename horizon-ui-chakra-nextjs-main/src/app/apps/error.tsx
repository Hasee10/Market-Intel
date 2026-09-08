'use client';

import { RouteError } from '@/components/ui/RouteError';

// Sits inside apps/layout.tsx, so the sidebar and header survive - only the
// page area is replaced. See components/ui/RouteError.tsx for the rationale.
export default function AppsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} scope="apps" />;
}
