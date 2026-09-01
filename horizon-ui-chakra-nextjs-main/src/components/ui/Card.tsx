'use client';

// The Tailwind surface primitive for migrated pages - TailAdmin's card:
// a 1px structural border and a 2xl radius rather than the ambient diffuse
// shadow Horizon used. Structured-enterprise dashboards (Ant Design Pro,
// Salesforce Lightning) define cards with borders for exactly this reason:
// borders stay legible at density, big soft shadows do not.

import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  /** Optional card title, rendered in the standard header row. */
  title?: string;
  /** Optional right-aligned slot in that same header row (badge, link). */
  action?: ReactNode;
}) {
  return (
    <div
      className={`font-outfit rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          {title && (
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h3>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export default Card;
