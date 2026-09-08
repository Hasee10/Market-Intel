'use client';

// Tailwind rebuild of sidebar/components/PlanBadge.tsx. Same copy, same link
// target - only the markup changed. The Chakra original stays in place until
// the old sidebar is deleted, so nothing that still renders it breaks.
//
// planTier arrives as a prop now. This used to GET /api/profile on every
// navigation to read one field that the layout's Seller object already had
// on it - a whole round trip (plus its own auth.getUser() hop) for a value
// already in hand. See lib/market-intel/seller/shell.ts.

import NextLink from 'next/link';

import { PATH_APPS } from '@/lib/paths';

const TIER_LABEL: Record<string, string> = {
  free: 'Free plan',
  paid: 'Paid plan',
  premium: 'Premium plan',
};

const TIER_BADGE: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  paid: 'bg-brand-50 text-brand-700 dark:bg-gray-800 dark:text-brand-400',
  premium: 'bg-orange-50 text-orange-700 dark:bg-gray-800 dark:text-orange-500',
};

const TIER_PITCH: Record<string, string> = {
  free: 'Refer 3 sellers to unlock Paid, free.',
  paid: 'Go Premium for forecasting & pricing recommendations.',
};

export function PlanCard({ isCollapsed, planTier }: { isCollapsed: boolean; planTier: string }) {
  const label = TIER_LABEL[planTier] ?? TIER_LABEL.free;
  const pitch = TIER_PITCH[planTier];

  // Collapsed keeps the tier visible rather than hiding the card outright -
  // the rail is narrow, not uninformative.
  if (isCollapsed) {
    return (
      <NextLink
        href={PATH_APPS.settings}
        title={label}
        className="mt-3 flex justify-center rounded-lg border border-gray-200 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 transition-colors hover:border-brand-300 dark:border-gray-800 dark:text-gray-400"
      >
        {planTier}
      </NextLink>
    );
  }

  return (
    <NextLink
      href={PATH_APPS.settings}
      className="mt-3 block rounded-xl border border-gray-200 bg-gray-25 p-3.5 transition-colors hover:border-brand-300 dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
            TIER_BADGE[planTier] ?? TIER_BADGE.free
          }`}
        >
          {label}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
          className="size-4 shrink-0 text-brand-400"
        >
          <path d="M12 3.5l2.5 5.2 5.5.8-4 3.9.95 5.6L12 16.3l-4.95 2.7L8 13.4 4 9.5l5.5-.8L12 3.5Z" />
        </svg>
      </div>
      {pitch && (
        <p className="mt-2 text-xs leading-snug text-gray-500 dark:text-gray-400">{pitch}</p>
      )}
    </NextLink>
  );
}
