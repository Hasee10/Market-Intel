'use client';

import { MdVisibilityOff, MdOutlineFilterAlt, MdLock } from 'react-icons/md';

import { Reveal } from 'components/reactbits/Reveal';
import { GlowCard } from '@/components/landing/GlowCard';
import { SectionTitle } from '@/components/landing/SectionTitle';

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
    <section className="font-manrope flex w-full flex-col items-center gap-7 px-4 pt-24 text-gray-700 sm:px-12 lg:px-24 xl:px-40 dark:text-white">
      <SectionTitle
        title="Peer benchmarking, not surveillance"
        desc="Nothing private about a competitor's business is ever shown - here's exactly how that works."
      />

      <div className="grid w-full max-w-6xl grid-cols-1 md:grid-cols-3">
        {POINTS.map((point, i) => {
          const Icon = point.icon;
          return (
            <Reveal key={point.title} delay={i * 120} className="m-2 sm:m-4">
              <GlowCard className="h-full">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-gray-100 text-[#5044E5] dark:bg-gray-700 dark:text-[#A594FF]">
                  <Icon className="size-6" aria-hidden="true" />
                </div>
                <h3 className="font-bold">{point.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-white/75">{point.description}</p>
              </GlowCard>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export default TrustSection;
