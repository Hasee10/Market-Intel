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
    // No hardcoded bg here: this section inherits the page ground like every
    // other one. It previously forced bg-white / dark:bg-gray-950, which cut a
    // hard seam across the page between it and its neighbours. Padding follows
    // the template's scale, matching the sections around it.
    <section className="font-manrope w-full px-4 pt-24 sm:px-12 lg:px-24 xl:px-40">
      <div className="mx-auto max-w-5xl">
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
          {/* A real <table>, not a stack of grid rows. The previous version
              painted the "With Ryvl" emphasis as an absolutely-positioned
              w-1/3 band, which could never line up with the actual third
              column once the rows carried horizontal padding - so the tint
              sat slightly off and bled past the rounded corner.

              The highlight now lives on the cells themselves, so it is
              exactly as wide as the column it belongs to, at any breakpoint. */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/60 dark:border-gray-700 dark:bg-gray-900 dark:shadow-black/20">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="w-1/3 px-5 py-4 md:px-7" />
                    <th className="w-1/3 px-5 py-4 text-xs font-bold uppercase tracking-[0.08em] text-gray-400">
                      Without Ryvl
                    </th>
                    <th className="w-1/3 bg-[#5044E5]/[0.05] px-5 py-4 text-xs font-bold uppercase tracking-[0.08em] text-[#5044E5] md:px-7 dark:bg-[#5044E5]/15 dark:text-[#A594FF]">
                      With Ryvl
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, i) => (
                    <tr
                      key={row.label}
                      className={i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}
                    >
                      <td className="px-5 py-5 align-top text-sm font-semibold text-[#111C4E] md:px-7 dark:text-white">
                        {row.label}
                      </td>

                      <td className="px-5 py-5 align-top text-sm text-gray-400 dark:text-gray-500">
                        <span className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/15">
                            <MdClose className="size-3.5 text-red-500" aria-hidden="true" />
                          </span>
                          <span className="line-through decoration-gray-300 dark:decoration-gray-600">
                            {row.without}
                          </span>
                        </span>
                      </td>

                      <td className="bg-[#5044E5]/[0.05] px-5 py-5 align-top text-sm font-medium text-gray-800 md:px-7 dark:bg-[#5044E5]/15 dark:text-white">
                        <span className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                            <MdCheck className="size-3.5" aria-hidden="true" />
                          </span>
                          {row.with}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default ComparisonSection;
