'use client';

import { CountUp } from 'components/reactbits/CountUp';
import { Reveal } from 'components/reactbits/Reveal';
import { MARKETPLACE_COUNT } from '@/lib/marketplaces';
import { AlertsMock, CategoryPickerMock, ScorecardRowsMock } from '@/components/landing/HowItWorksVisual';

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
    visual: <CategoryPickerMock />,
  },
  {
    step: '02',
    title: 'We track the market for you',
    description: `Competitor pricing and stock across ${MARKETPLACE_COUNT} marketplaces refresh automatically, alongside your own store's orders, products, and customers - all in one dashboard.`,
    visual: <ScorecardRowsMock />,
  },
  {
    step: '03',
    title: 'Act on real signals',
    description:
      'Price alerts when a watched competitor changes, pricing recommendations that respect your margin floor, and at-risk customer lists - not just charts to look at.',
    visual: <AlertsMock />,
  },
];

export function HowItWorksSection() {
  return (
    // No hardcoded bg - see ComparisonSection.tsx's own note on this exact
    // mistake: this section inherits the page ground (Chakra body token,
    // theme/styles.ts) like every other one, instead of forcing its own
    // close-but-not-quite approximation that cuts a seam against neighbours.
    <section id="how-it-works" className="font-manrope py-[70px] md:py-[100px]">
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
                {/* Fixed-height stage, same reasoning as ShowcaseSection's own
                    "Fixed-height stage" comment: the three mockups are not
                    the same height, and letting each column size to its own
                    content made the row's baselines drift. */}
                <div className="mb-5 flex h-[132px] items-center rounded-xl bg-white/60 p-3 dark:bg-white/5">
                  {item.visual}
                </div>
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
