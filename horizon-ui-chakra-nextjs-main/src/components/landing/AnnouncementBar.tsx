'use client';

import { useState } from 'react';

import NextLink from 'next/link';
import { MdClose } from 'react-icons/md';

// Thin top banner above the header (Atlassian/Astra-style promo strip) -
// ties to the real referral mechanic (see lib/market-intel/referrals.ts),
// not a fabricated "we have X customers" claim.
export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="font-manrope bg-gradient-to-r from-[#4318FF] to-[#6A47FF] py-2.5">
      <div className="relative mx-auto flex max-w-[1200px] items-center justify-center gap-2 px-5 md:px-[30px]">
        <p className="text-center text-sm text-white">
          🚀 Invite 3 sellers and unlock the Paid plan free -{' '}
          <NextLink href="/pricing" className="font-semibold underline">
            see how it works
          </NextLink>
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss announcement"
          className="absolute right-0 text-white/80 transition-colors hover:text-white"
        >
          <MdClose className="size-[18px]" />
        </button>
      </div>
    </div>
  );
}

export default AnnouncementBar;
