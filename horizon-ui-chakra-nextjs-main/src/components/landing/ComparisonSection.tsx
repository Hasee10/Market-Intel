'use client';

import { MdClose, MdCheck } from 'react-icons/md';

import { Reveal } from 'components/reactbits/Reveal';
import { MARKETPLACE_COUNT } from '@/lib/marketplaces';

// Compares against the real alternative most sellers actually have today
// (checking competitor sites by hand, spreadsheets) - not a fabricated
// vs.-named-competitor table with claims that can't be backed up.
const ROWS = [
  {
    label: 'Checking competitor prices',
    without: 'Manually, site by site',
    with: `Tracked automatically across ${MARKETPLACE_COUNT} marketplaces`,
  },
  {
    label: 'Knowing your price position',
    without: 'Guesswork',
    with: 'Benchmarked against your category, live',
  },
  {
    label: 'Catching a competitor price drop',
    without: 'Only if you happen to check',
    with: 'Alerted the moment it changes',
  },
  {
    label: 'Setting your own prices',
    without: 'Gut feeling',
    with: 'A margin-safe recommendation',
  },
  {
    label: 'Spotting at-risk customers',
    without: "Usually you don't, until they've churned",
    with: 'Flagged before they go quiet',
  },
];

export function ComparisonSection() {
  return (
    <section className="font-manrope bg-white py-[70px] md:py-[100px] dark:bg-gray-950">
      <div className="mx-auto max-w-[1000px] px-5 md:px-[30px]">
        <Reveal>
          <div className="mb-10 text-center md:mb-14">
            <h2 className="text-[28px] font-medium tracking-[-0.02em] text-[#111C4E] md:text-4xl dark:text-white">
              What most sellers do today, vs. Ryvl
            </h2>
            <p className="mx-auto mt-3 max-w-[560px] text-lg text-gray-600 dark:text-gray-400">
              Not a competitor comparison - a comparison against how this actually gets done without
              a tool.
            </p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="grid grid-cols-3 bg-[#F7F8FF] px-4 py-3.5 md:px-7 dark:bg-gray-900">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Without Ryvl
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#5044E5] dark:text-[#A594FF]">
                With Ryvl
              </span>
            </div>

            {ROWS.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-3 items-start gap-3 border-t border-gray-100 px-4 py-4 transition-colors hover:bg-[#FAFAFF] md:px-7 dark:border-gray-800 dark:hover:bg-gray-900"
              >
                <span className="text-sm font-medium text-[#111C4E] dark:text-white">
                  {row.label}
                </span>

                <span className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-gray-800">
                    <MdClose className="size-3.5 text-red-500" aria-hidden="true" />
                  </span>
                  {row.without}
                </span>

                <span className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green-50 dark:bg-gray-800">
                    <MdCheck className="size-3.5 text-green-600" aria-hidden="true" />
                  </span>
                  {row.with}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default ComparisonSection;
