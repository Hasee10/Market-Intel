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

const COLUMN_CLASS: Record<number, string> = {
  1: 'sm:grid-cols-1 xl:grid-cols-1',
  2: 'sm:grid-cols-2 xl:grid-cols-2',
  3: 'sm:grid-cols-2 xl:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
};

type StatsGridProps = {
  data: StatItem[];
  loading?: boolean;
  columns?: number;
};

export function StatsGrid({ data, loading, columns = 4 }: StatsGridProps) {
  const gridClass = `mb-5 grid grid-cols-1 gap-4 ${COLUMN_CLASS[columns] ?? COLUMN_CLASS[4]}`;

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
        const trendClass =
          diff < 0
            ? 'text-error-600 dark:text-error-500'
            : diff > 0
              ? 'text-success-600 dark:text-success-500'
              : 'text-gray-500 dark:text-gray-400';

        return (
          <Reveal key={item.title} delay={index * 60}>
            <div className="h-full rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
              <div className={`flex size-11 items-center justify-center rounded-xl ${chipClass}`}>
                <Chip className="size-[22px]" aria-hidden="true" />
              </div>

              <div className="mt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.title}</p>
                <p className="mt-1.5 text-2xl font-semibold -tracking-[0.02em] text-gray-900 tabular-nums dark:text-white">
                  <CountUp value={item.value} />
                </p>
                {(diff !== 0 || item.period) && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs">
                    {diff !== 0 && (
                      <span className={`font-semibold ${trendClass}`}>
                        {diff > 0 ? '+' : ''}
                        {diff}%
                      </span>
                    )}
                    {item.period && (
                      <span className="text-gray-500 dark:text-gray-400">{item.period}</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

export default StatsGrid;
