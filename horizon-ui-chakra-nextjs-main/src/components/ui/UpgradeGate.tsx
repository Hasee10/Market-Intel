'use client';

import { ReactNode } from 'react';

import Link from 'next/link';
import { MdLock } from 'react-icons/md';

import { PATH_APPS } from '@/lib/paths';

type UpgradeGateProps = {
  hasAccess: boolean;
  requiredPlanLabel: string;
  featureName: string;
  children: ReactNode;
};

// Soft-gates a feature: shows the real content if the seller's plan_tier
// covers it (see entitlements.ts), otherwise a locked upsell card in its
// place. No payment flow behind "Upgrade" yet (see entitlements.ts's
// comment) - it links to Settings, where plan tier is visible, rather than
// pretending there's a working checkout.
export function UpgradeGate({
  hasAccess,
  requiredPlanLabel,
  featureName,
  children,
}: UpgradeGateProps) {
  if (hasAccess) return <>{children}</>;

  return (
    // The one screen in the app that is asking for money, so it earns a bit
    // more treatment than a plain card - a locked feature should still look
    // like something worth unlocking rather than a dead end.
    <div className="font-outfit mb-5 rounded-2xl border border-gray-200 bg-gradient-to-br from-brand-25 to-white px-5 py-8 text-center dark:border-gray-800 dark:from-gray-900 dark:to-gray-950">
      <div className="mx-auto flex max-w-[420px] flex-col items-center gap-2">
        <MdLock className="size-6 text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <p className="text-lg font-bold text-gray-900 dark:text-white">{featureName}</p>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-gray-800 dark:text-brand-400">
          {requiredPlanLabel} plan required
        </span>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This feature isn&apos;t included on your current plan.
        </p>
        <Link
          href={PATH_APPS.settings}
          className="mt-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          View plans in Settings
        </Link>
      </div>
    </div>
  );
}

export default UpgradeGate;
