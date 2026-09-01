'use client';

// Tailwind StatsGrid, styled after TailAdmin's EcommerceMetrics but keeping
// this app's richer structure - TailAdmin ships 2 hardcoded tiles, this
// renders N from real API data with a per-metric icon and colour.
//
// Behaviour preserved exactly from the Chakra version: the API's icon/colour
// keys still drive distinct chips (four identical grey boxes was the thing
// that pass fixed), trend colour still follows the sign of `diff` (a decline
// must not be styled as growth), `period` is still rendered verbatim, and
// CountUp/Reveal are reused rather than dropped, so the count-up and the
// staggered entrance both survive.

import type { IconType } from 'react-icons';
import {
  MdArrowUpward,
  MdArrowDownward,
  MdTrendingFlat,
  MdOutlineAttachMoney,
  MdOutlineShoppingCart,
  MdOutlineReceiptLong,
  MdOutlineGroup,
  MdOutlineInsertChartOutlined,
  MdOutlineRemoveShoppingCart,
} from 'react-icons/md';

import CountUp from 'components/reactbits/CountUp';
import Reveal from 'components/reactbits/Reveal';

export type StatItem = {
  title: string;
  value: string;
  diff?: number;
  period?: string;
  /** Matches app/api/ecommerce/stats/route.ts's icon keys. */
  icon?: string;
  /** Colour key from the same route - falls back to a neutral chip. */
  color?: string;
};

const ICON_MAP: Record<string, IconType> = {
  'currency-dollar': MdOutlineAttachMoney,
  'shopping-cart': MdOutlineShoppingCart,
  receipt: MdOutlineReceiptLong,
  users: MdOutlineGroup,
  'chart-line': MdOutlineInsertChartOutlined,
  'shopping-cart-off': MdOutlineRemoveShoppingCart,
};

// Static class strings, not interpolated - Tailwind scans source text, so a
// template-literal class name would never make it into the built stylesheet.
const CHIP: Record<string, string> = {
  blue: 'bg-brand-50 text-brand-600 dark:bg-gray-800 dark:text-brand-400',
  teal: 'bg-success-50 text-success-700 dark:bg-gray-800 dark:text-success-500',
  orange: 'bg-orange-50 text-orange-700 dark:bg-gray-800 dark:text-orange-500',
  pink: 'bg-error-50 text-error-600 dark:bg-gray-800 dark:text-error-500',
  violet: 'bg-brand-50 text-brand-700 dark:bg-gray-800 dark:text-brand-400',
  red: 'bg-error-50 text-error-700 dark:bg-gray-800 dark:text-error-500',
};
const CHIP_FALLBACK = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

// CONTAINER queries, not viewport ones. The sidebar is 264px wide, so the
// cards sit in a box roughly that much narrower than the window - a
// viewport-based `xl:` was measuring space the grid never had.
//
// It also made the layout depend on the device in a way that looked random:
// Windows defaults to 125% display scaling on many laptops, so a 1366px
// screen reports 1092 CSS px, falls under xl, and silently drops from four
// columns to two. @container asks the only question that matters - how wide
// is the grid actually allowed to be.
const COLUMN_CLASS: Record<number, string> = {
  1: '@md:grid-cols-1',
  2: '@md:grid-cols-2',
  3: '@md:grid-cols-2 @4xl:grid-cols-3',
  4: '@md:grid-cols-2 @4xl:grid-cols-4',
};

type StatsGridProps = {
  data: StatItem[];
  loading?: boolean;
  columns?: number;
};

export function StatsGrid({ data, loading, columns = 4 }: StatsGridProps) {
  // COLUMN_CLASS's queries resolve against the @container on AdminShell's
  // <main>, not against this element - an element is never its own query
  // container, so the @container here only scopes descendants (none of the
  // cards below use container variants today). Any page rendering this
  // outside AdminShell needs its own @container ancestor or the grid falls
  // back to grid-cols-1. gap-4 md:gap-6 is TailAdmin's rhythm throughout.
  const gridClass = `@container mb-6 grid grid-cols-1 gap-4 md:gap-6 ${
    COLUMN_CLASS[columns] ?? COLUMN_CLASS[4]
  }`;

  if (loading) {
    return (
      <div className={gridClass}>
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="h-[116px] animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {data.map((item, index) => {
        const diff = item.diff ?? 0;
        const TrendIcon = diff < 0 ? MdArrowDownward : diff > 0 ? MdArrowUpward : MdTrendingFlat;
        const Chip = (item.icon && ICON_MAP[item.icon]) || TrendIcon;
        const chipClass = (item.color && CHIP[item.color]) || CHIP_FALLBACK;
        // TailAdmin's Badge: tinted pill, not coloured text. Tone still
        // follows the sign of diff - a decline must never read as growth.
        const badgeClass =
          diff < 0
            ? 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
            : 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500';

        return (
          <Reveal key={item.title} delay={index * 60}>
            {/* Markup mirrors TailAdmin's EcommerceMetrics: icon chip on its
                own row, then label + value on the left with the change as a
                pill badge bottom-aligned on the right. */}
            <div className="h-full rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md md:p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className={`flex size-12 items-center justify-center rounded-xl ${chipClass}`}>
                <Chip className="size-6" aria-hidden="true" />
              </div>

              <div className="mt-5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{item.title}</span>
                  <h4 className="mt-2 text-title-sm font-bold text-gray-800 tabular-nums dark:text-white/90">
                    <CountUp value={item.value} />
                  </h4>
                </div>

                {diff !== 0 && (
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                  >
                    <TrendIcon className="size-3" aria-hidden="true" />
                    {Math.abs(diff)}%
                  </span>
                )}
              </div>

              {item.period && (
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{item.period}</p>
              )}
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

export default StatsGrid;
