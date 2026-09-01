'use client';

import { MdVisibilityOff, MdOutlineFilterAlt, MdLock } from 'react-icons/md';

import { Reveal } from 'components/reactbits/Reveal';

// Same wording as the "Peer benchmarking, not surveillance" alert on the
// actual Market page (dashboard/market/MarketView.tsx) - the landing page
// promise and the in-product behavior should say the same thing, not two
// different stories.
const POINTS = [
  {
    icon: MdVisibilityOff,
    title: 'Aggregate or opt-in only',
    description:
      'You only ever see anonymized, aggregate benchmarks - or fields a peer has explicitly chosen to share, like rating or price position.',
  },
  {
    icon: MdOutlineFilterAlt,
    title: 'A sample-size floor',
    description:
      "Benchmarks don't compute at all until enough sellers share a category, so no single competitor's numbers can be reverse-engineered.",
  },
  {
    icon: MdLock,
    title: 'Your private data stays private',
    description:
      'Your own orders, customers, and churn numbers are never visible to another seller - full stop, no setting can change that.',
  },
];

export function TrustSection() {
  return (
    <section className="font-manrope bg-[#F7F8FF] py-[70px] md:py-[100px] dark:bg-gray-900">
      <div className="mx-auto max-w-[1200px] px-5 md:px-[30px]">
        <Reveal>
          <div className="mb-12 text-center md:mb-[72px]">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[#4318FF] dark:text-[#A594FF]">
              How it works
            </p>
            <h2 className="text-[28px] font-medium tracking-[-0.02em] text-[#111C4E] md:text-[40px] dark:text-white">
              Peer benchmarking, not surveillance
            </h2>
            <p className="mx-auto mt-4 max-w-[620px] text-lg text-gray-600 dark:text-gray-400">
              Nothing private about a competitor&apos;s business is ever shown - here&apos;s exactly
              how that works.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-7 md:grid-cols-3">
          {POINTS.map((point, i) => {
            const Icon = point.icon;
            return (
              <Reveal key={point.title} delay={i * 100}>
                <div className="h-full rounded-2xl border border-gray-100 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-gray-950">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#F4F1FF] text-[#4318FF] dark:bg-gray-800 dark:text-[#A594FF]">
                    <Icon className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2.5 text-lg font-bold text-[#111C4E] dark:text-white">
                    {point.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    {point.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default TrustSection;
