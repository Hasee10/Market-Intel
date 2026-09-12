'use client';

import type { ReactNode } from 'react';
import {
  MdErrorOutline,
  MdInfoOutline,
  MdOutlineCheckCircle,
  MdOutlineWarningAmber,
} from 'react-icons/md';

export type AlertStatus = 'info' | 'success' | 'warning' | 'error';

// General-purpose inline alert. ErrorAlert stays separate because it has a
// narrower, fixed shape (title + message) used on the CRUD pages; this one
// takes arbitrary children so pages can put links and lists inside.
const STATUS: Record<AlertStatus, { wrap: string; icon: string; title: string; body: string }> = {
  info: {
    wrap: 'border-brand-200 bg-brand-25 dark:border-gray-800 dark:bg-gray-900',
    icon: 'text-brand-600 dark:text-brand-400',
    title: 'text-brand-800 dark:text-white',
    body: 'text-brand-700 dark:text-gray-400',
  },
  success: {
    wrap: 'border-success-200 bg-success-50 dark:border-gray-800 dark:bg-gray-900',
    icon: 'text-success-600 dark:text-success-500',
    title: 'text-success-800 dark:text-white',
    body: 'text-success-700 dark:text-gray-400',
  },
  warning: {
    wrap: 'border-orange-200 bg-orange-50 dark:border-gray-800 dark:bg-gray-900',
    icon: 'text-orange-600 dark:text-orange-500',
    title: 'text-orange-900 dark:text-white',
    body: 'text-orange-700 dark:text-gray-400',
  },
  error: {
    wrap: 'border-error-200 bg-error-50 dark:border-gray-800 dark:bg-gray-900',
    icon: 'text-error-600 dark:text-error-500',
    title: 'text-error-800 dark:text-white',
    body: 'text-error-700 dark:text-gray-400',
  },
};

const ICONS: Record<AlertStatus, typeof MdInfoOutline> = {
  info: MdInfoOutline,
  success: MdOutlineCheckCircle,
  warning: MdOutlineWarningAmber,
  error: MdErrorOutline,
};

export function Alert({
  status = 'info',
  title,
  children,
  className = '',
}: {
  status?: AlertStatus;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const tone = STATUS[status];
  const Icon = ICONS[status];

  return (
    <div
      role={status === 'error' ? 'alert' : undefined}
      className={`font-outfit flex gap-3 rounded-2xl border p-4 ${tone.wrap} ${className}`}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${tone.icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className={`text-sm font-semibold ${tone.title}`}>{title}</p>}
        {children && (
          <div className={`text-[13px] leading-snug ${tone.body} ${title ? 'mt-0.5' : ''}`}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default Alert;
