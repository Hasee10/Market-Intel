'use client';

// Tailwind InsightStrip - the shared visual chrome for every "instant
// insight" banner (Overview, Market, Watchlist, Products, Orders,
// Competitors, RetentionPanel). Only the chrome moved; each page's rule
// logic (InsightBanner.computeTopInsight and friends) is untouched.
//
// Tone is semantic and deliberately independent of the brand indigo: good /
// warning / critical must read as status, not decoration, so they keep the
// success / orange / error scales while `neutral` is the only tone that uses
// brand colour.

import type { IconType } from 'react-icons';
import Link from 'next/link';

export type Tone = 'good' | 'warning' | 'critical' | 'neutral';

export type Insight = {
  tone: Tone;
  icon: IconType;
  headline: string;
  detail: string;
  ctaLabel?: string;
  ctaHref?: string;
};

// Full static class strings per tone - Tailwind scans source text, so these
// can't be built by interpolation or they'd be absent from the stylesheet.
const TONE: Record<Tone, { wrap: string; chip: string; head: string; body: string; cta: string }> = {
  good: {
    wrap: 'border-success-200 bg-success-50 dark:border-gray-800 dark:bg-gray-900',
    chip: 'bg-success-100 text-success-700 dark:bg-gray-800 dark:text-success-500',
    head: 'text-success-800 dark:text-white',
    body: 'text-success-700 dark:text-gray-400',
    cta: 'text-success-700 hover:text-success-800 dark:text-success-500',
  },
  warning: {
    wrap: 'border-orange-200 bg-orange-50 dark:border-gray-800 dark:bg-gray-900',
    chip: 'bg-orange-100 text-orange-700 dark:bg-gray-800 dark:text-orange-500',
    head: 'text-orange-900 dark:text-white',
    body: 'text-orange-700 dark:text-gray-400',
    cta: 'text-orange-700 hover:text-orange-900 dark:text-orange-500',
  },
  critical: {
    wrap: 'border-error-200 bg-error-50 dark:border-gray-800 dark:bg-gray-900',
    chip: 'bg-error-100 text-error-700 dark:bg-gray-800 dark:text-error-500',
    head: 'text-error-800 dark:text-white',
    body: 'text-error-700 dark:text-gray-400',
    cta: 'text-error-700 hover:text-error-800 dark:text-error-500',
  },
  neutral: {
    wrap: 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900',
    chip: 'bg-brand-50 text-brand-600 dark:bg-gray-800 dark:text-brand-400',
    head: 'text-gray-900 dark:text-white',
    body: 'text-gray-500 dark:text-gray-400',
    cta: 'text-brand-500 hover:text-brand-600 dark:text-brand-400',
  },
};

export function InsightStrip({ insight }: { insight: Insight }) {
  const tone = TONE[insight.tone];
  const Icon = insight.icon;

  return (
    <div
      className={`font-outfit mb-5 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-4 ${tone.wrap}`}
    >
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone.chip}`}>
        <Icon className="size-5" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${tone.head}`}>{insight.headline}</p>
        <p className={`mt-0.5 text-[13px] leading-snug ${tone.body}`}>{insight.detail}</p>
      </div>

      {insight.ctaLabel && insight.ctaHref && (
        <Link
          href={insight.ctaHref}
          className={`shrink-0 text-sm font-medium transition-colors ${tone.cta}`}
        >
          {insight.ctaLabel} &rarr;
        </Link>
      )}
    </div>
  );
}

export default InsightStrip;
