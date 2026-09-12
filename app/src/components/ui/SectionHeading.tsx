'use client';

// Section divider inside a page (e.g. "Revenue & fulfillment"). Replaces the
// Chakra accent-bar + Merriweather-serif heading: the serif read editorial on
// a page meant to be scanned for numbers, and a coloured bar next to every
// heading is decoration that encodes nothing. Weight and spacing carry the
// hierarchy instead.
//
// `meta` is the right-hand slot Overview uses for its compact
// active-products / low-stock counts.

import type { ReactNode } from 'react';

export function SectionHeading({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="font-outfit mb-3.5 mt-6 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h2>
      {meta}
    </div>
  );
}

export default SectionHeading;
