'use client';

// Composable table primitives in TailAdmin's styling, so the ten-odd places
// that render a table stop each hand-rolling their own cell padding and
// border colours. Deliberately primitives rather than one config-driven
// <DataTable columns={...} /> - these tables have genuinely different cells
// (badges, links, action buttons, drawers), and a config API would end up
// with an escape hatch on every column anyway.
//
// Table always wraps itself in an overflow-x container: wide content must
// scroll inside its own box so the page body never scrolls sideways.

import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';

export function Table({
  children,
  minWidth = 560,
  className = '',
}: {
  children: ReactNode;
  /** Below this the table scrolls rather than crushing its columns. */
  minWidth?: number;
  className?: string;
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table
        style={{ minWidth }}
        className={`w-full border-collapse font-outfit ${className}`}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-gray-200 dark:border-gray-800">{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  numeric,
  className = '',
  ...rest
}: { children?: ReactNode; numeric?: boolean; className?: string } & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...rest}
      className={`pb-3 pr-3 text-[11px] font-medium uppercase tracking-[0.04em] text-gray-400 last:pr-0 ${
        numeric ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <tr
      className={`border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800 ${className}`}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  numeric,
  strong,
  className = '',
  ...rest
}: {
  children?: ReactNode;
  numeric?: boolean;
  /** Emphasised cell - the row's identifying value, or a total. */
  strong?: boolean;
  className?: string;
} & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...rest}
      className={`py-3 pr-3 text-sm last:pr-0 ${numeric ? 'text-right tabular-nums' : 'text-left'} ${
        strong
          ? 'font-medium text-gray-900 dark:text-white'
          : 'text-gray-600 dark:text-gray-400'
      } ${className}`}
    >
      {children}
    </td>
  );
}

// Small status/category pill used inside table cells across several pages.
const BADGE_TONES: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-gray-800 dark:text-brand-400',
  success: 'bg-success-50 text-success-700 dark:bg-gray-800 dark:text-success-500',
  warning: 'bg-orange-50 text-orange-700 dark:bg-gray-800 dark:text-orange-500',
  error: 'bg-error-50 text-error-700 dark:bg-gray-800 dark:text-error-500',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES | string;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium ${
        BADGE_TONES[tone] ?? BADGE_TONES.neutral
      }`}
    >
      {children}
    </span>
  );
}
