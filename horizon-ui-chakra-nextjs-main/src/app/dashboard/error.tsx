'use client';

import { RouteError } from '@/components/ui/RouteError';

// Sits inside dashboard/layout.tsx - same shape as apps/error.tsx, keeping
// the shell while the page area shows the failure.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} scope="dashboard" />;
}
