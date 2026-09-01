'use client';

import { useEffect, useMemo, useState } from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';

// Client-side pagination for lists already fully in memory.
//
// Everything on the Market page arrives as one server-rendered array, so
// there is nothing to fetch per page - the only problem being solved is that
// a 40-row table buried every section under it. Paging server-side here would
// add round-trips to fix a scrolling problem.

export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  // Clamp when the list shrinks under us - filtering down to three rows while
  // sitting on page 4 would otherwise render an empty table with no way back.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const safePage = Math.min(page, pageCount);
  const visible = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  return {
    visible,
    page: safePage,
    pageCount,
    setPage,
    /** Below one full page there is nothing to page through - render nothing. */
    isPaged: items.length > pageSize,
    rangeStart: (safePage - 1) * pageSize + 1,
    rangeEnd: Math.min(safePage * pageSize, items.length),
    total: items.length,
  };
}

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  /** Noun for the count, e.g. "products". Defaults to "rows". */
  label?: string;
};

export function Pagination({
  page,
  pageCount,
  onPageChange,
  rangeStart,
  rangeEnd,
  total,
  label = 'rows',
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const buttonBase =
    'flex size-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors enabled:hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:enabled:hover:bg-gray-800';

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800"
    >
      {/* The count is the useful half: it tells you the list is longer than
          what you can see, which is the thing a scrolling table hid. */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Showing <span className="font-semibold text-gray-700 dark:text-gray-200">{rangeStart}</span>
        {'–'}
        <span className="font-semibold text-gray-700 dark:text-gray-200">{rangeEnd}</span> of{' '}
        <span className="font-semibold text-gray-700 dark:text-gray-200">{total}</span> {label}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={buttonBase}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <MdChevronLeft className="size-5" />
        </button>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          className={buttonBase}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <MdChevronRight className="size-5" />
        </button>
      </div>
    </nav>
  );
}

export default Pagination;
