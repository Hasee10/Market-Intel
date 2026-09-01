'use client';

import { CountUp } from 'components/reactbits/CountUp';
import { Reveal } from 'components/reactbits/Reveal';
import { MARKETPLACE_COUNT } from '@/lib/marketplaces';

// The actual seller journey through the product, not the privacy mechanics
// (that's TrustSection) - a concrete 3-step process bridges "what is this"
// (hero) to "what you get" (features).
//
// The numbered markers are kept here because this genuinely IS a sequence -
// step 2 can't happen before step 1. That's also why SectionHeading in the
// dashboard dropped its decorative bar: markers should encode something.
const STEPS = [
  {
    step: '01',
    title: 'Pick your category',
    description:
      'One-time setup after signup - choose the category you sell in (mobiles, fashion, and more as coverage expands). This decides which scraped market data and anonymized peers you get benchmarked against.',
  },
  {
    step: '02',
    title: 'We track the market for you',
    description: `Competitor pricing and stock across ${MARKETPLACE_COUNT} marketplaces refresh automatically, alongside your own store's orders, products, and customers - all in one dashboard.`,
  },
  {
    step: '03',
    title: 'Act on real signals',
    description:
      'Price alerts when a watched competitor changes, pricing recommendations that respect your margin floor, and at-risk customer lists - not just charts to look at.',
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="font-manrope bg-[#F7F8FF] py-[70px] md:py-[100px] dark:bg-gray-900"
    >
      <div className="mx-auto max-w-[1200px] px-5 md:px-[30px]">
        <Reveal>
          <div className="mb-12 text-center md:mb-[72px]">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[#5044E5] dark:text-[#A594FF]">
              The process
            </p>
            <h2 className="text-[28px] font-medium tracking-[-0.02em] text-[#111C4E] md:text-[40px] dark:text-white">
              From signup to your first insight
            </h2>
            <p className="mx-auto mt-4 max-w-[560px] text-lg text-gray-600 dark:text-gray-400">
              No setup calls, no data imports required to start - just pick a category and the market
              context is already there.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((item, i) => (
            <Reveal key={item.step} delay={i * 100}>
              <div className="flex flex-col">
                <p className="mb-3 text-5xl font-extrabold leading-none text-[#E4DBFF] tabular-nums dark:text-white/20">
                  <CountUp value={item.step} />
                </p>
                <h3 className="mb-2.5 text-lg font-bold text-[#111C4E] dark:text-white">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {item.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWorksSection;
