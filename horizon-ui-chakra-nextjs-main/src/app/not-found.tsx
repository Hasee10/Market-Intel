import Link from 'next/link';

import { PATH_DASHBOARD } from '@/lib/paths';

// Without this file Next serves its own unstyled default 404, which reads as
// a broken deploy rather than a wrong URL. Server Component on purpose: it
// needs no interactivity, and 404s should not ship JS to render.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-24 text-center">
      <p className="font-mono text-sm font-semibold text-brand-600 dark:text-brand-400">404</p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Page not found</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        That link doesn&apos;t point anywhere in Ryvl - it may have moved, or the address may be
        mistyped.
      </p>
      <Link
        href={PATH_DASHBOARD.default}
        className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
