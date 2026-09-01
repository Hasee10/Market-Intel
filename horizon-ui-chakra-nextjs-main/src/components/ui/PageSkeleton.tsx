'use client';

import { Card } from '@/components/ui/Card';

// Route-level loading UI for the server-rendered dashboard pages.
//
// Those pages fetch everything server-side before returning any HTML, so
// without a loading.tsx Next.js has nothing to show during the navigation -
// the browser sits on the *previous* page, fully interactive-looking but
// unresponsive to further clicks, until the new page's last query resolves.
// That dead interval is most of what "the app feels slow" means here, and it
// is invisible in a query-timing audit because no single query is slow.
//
// Deliberately mirrors the real page's layout (header, stat row, chart/table
// blocks) rather than a generic spinner, so the shell doesn't jump when the
// real content swaps in.
const bar = 'animate-pulse rounded-md bg-gray-200 dark:bg-gray-800';

// Static class strings, not interpolated - Tailwind scans source text.
const STAT_COLUMNS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

export function PageSkeleton({
  stats = 4,
  blocks = 2,
}: {
  /** KPI cards in the top row. 0 to omit the row entirely. */
  stats?: number;
  /** Large content cards below the stat row. */
  blocks?: number;
}) {
  return (
    <div className="font-outfit">
      <div className="mb-5 flex items-center justify-between">
        <div className={`${bar} h-8 w-[220px]`} />
        <div className={`${bar} h-9 w-[140px]`} />
      </div>

      {stats > 0 && (
        <div className={`mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 ${STAT_COLUMNS[stats] ?? ''}`}>
          {Array.from({ length: stats }).map((_, i) => (
            <Card key={i}>
              <div className={`${bar} mb-2.5 h-3.5 w-3/5`} />
              <div className={`${bar} h-6 w-2/5`} />
            </Card>
          ))}
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${blocks > 1 ? 'lg:grid-cols-3' : ''}`}>
        {Array.from({ length: blocks }).map((_, i) => (
          <Card key={i} className={blocks > 1 && i === 0 ? 'lg:col-span-2' : ''}>
            <div className={`${bar} mb-3.5 h-4.5 w-[180px]`} />
            <div className={`${bar} h-[260px] rounded-xl`} />
          </Card>
        ))}
      </div>
    </div>
  );
}

export default PageSkeleton;
