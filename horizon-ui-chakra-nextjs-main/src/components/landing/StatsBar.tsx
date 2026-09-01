'use client';

import { MdStorefront, MdCategory, MdSchedule, MdShield } from 'react-icons/md';

import { CountUp } from 'components/reactbits/CountUp';
import { Reveal } from 'components/reactbits/Reveal';
import { MARKETPLACE_COUNT } from '@/lib/marketplaces';

// Seller category count (12) is deliberately NOT seller_categories' row
// count (13) - the 13th row, 'other', is a catch-all fallback with zero
// real coverage, so counting it would overstate what we actually track.
const STATS = [
  { icon: MdStorefront, value: String(MARKETPLACE_COUNT), label: 'Marketplaces tracked live' },
  { icon: MdCategory, value: '12', label: 'Seller categories supported' },
  { icon: MdSchedule, value: '48hrs', label: 'Max data refresh cycle' },
  { icon: MdShield, value: '0', label: 'Raw competitor data ever shown to you' },
];

export function StatsBar() {
  return (
    <div className="font-manrope relative py-0 md:py-5">
      <div className="mx-auto max-w-[1200px] px-5 md:px-[30px]">
        <div className="rounded-3xl border border-gray-100 bg-white px-6 py-10 md:px-12 md:py-12 dark:border-gray-800 dark:bg-gray-900">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-4">
            {STATS.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <Reveal key={stat.label} delay={i * 80}>
                  <div className="flex flex-col items-start text-left md:items-center md:text-center">
                    <Icon
                      className="mb-3 size-6 text-[#4318FF] dark:text-[#A594FF]"
                      aria-hidden="true"
                    />
                    <p className="text-[32px] font-semibold tracking-[-0.03em] text-[#111C4E] tabular-nums md:text-4xl dark:text-white">
                      <CountUp value={stat.value} />
                    </p>
                    <p className="mt-1.5 text-[13px] leading-snug text-gray-500 dark:text-gray-400">
                      {stat.label}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsBar;
