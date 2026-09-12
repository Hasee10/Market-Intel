'use client';

import NextLink from 'next/link';
import { MdCheck } from 'react-icons/md';

import { PATH_AUTH } from '@/lib/paths';

// Mirrors the actual tier boundaries in lib/market-intel/entitlements.ts -
// this is the real gating logic in the app, not aspirational marketing
// tiers invented for the landing page. No dollar figures: there's no
// billing provider wired up yet (see entitlements.ts), so a fabricated
// price would just be a lie the moment someone tries to check out.
const TIERS = [
  {
    name: 'Free',
    tagline: 'Your own store, fully analyzed',
    features: [
      'Overview, products, customers, orders',
      'Churn & retention insights',
      'Bulk CSV import',
    ],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Paid',
    tagline: 'See what your competitors charge',
    features: [
      'Everything in Free',
      'Competitor scorecards',
      'Competitor product matching',
      'Pricing recommendations',
      'Watchlists & price alerts',
    ],
    cta: 'Start free',
    highlighted: true,
    note: 'Or unlock it free - refer 3 sellers',
  },
  {
    name: 'Premium',
    tagline: 'Forecasting and scale',
    features: [
      'Everything in Paid',
      'Price forecasting & revenue projection',
      'Anomaly detection',
      'Multiple domains',
      // Deliberately last and hedged: domain_benchmarks needs 3+ opted-in
      // sellers in a category before it renders anything (benchmarks-job.ts),
      // so promising it flatly would be selling a screen that may be empty
      // on the day someone pays. Keep the wording conditional until the
      // network is dense enough for it to be a headline.
      'Peer benchmarking, as your category fills up',
    ],
    cta: 'Start free',
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="font-manrope py-[70px] md:py-[100px]">
      <div className="mx-auto max-w-[1200px] px-5 md:px-[30px]">
        <div className="mb-14 text-center">
          <h2 className="text-[28px] font-medium tracking-[-0.02em] text-[#111C4E] md:text-4xl dark:text-white">
            Grows with how deep you want to go
          </h2>
          <p className="mx-auto mt-3 max-w-[560px] text-lg text-gray-600 dark:text-gray-400">
            Start free on your own store. Unlock market intelligence as you need it.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-[20px] border p-8 ${
                tier.highlighted
                  ? 'border-[#5044E5] shadow-[0_20px_40px_rgba(67,24,255,0.15)] dark:shadow-[0_0_0_1px_#5044E5]'
                  : 'border-gray-100 dark:border-gray-800'
              }`}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-8 rounded-full bg-[#F0EDFF] px-2.5 py-1 text-xs font-semibold text-[#5044E5] dark:bg-gray-800 dark:text-[#A594FF]">
                  Most popular
                </span>
              )}

              <p className="mb-1 text-xl font-extrabold text-[#111C4E] dark:text-white">
                {tier.name}
              </p>
              <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">{tier.tagline}</p>

              <div className="mb-7 flex flex-col gap-3">
                {tier.features.map((feature) => (
                  <span key={feature} className="flex items-start gap-2.5">
                    <MdCheck
                      className="mt-0.5 size-4 shrink-0 text-[#5044E5] dark:text-[#A594FF]"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                  </span>
                ))}
              </div>

              <NextLink
                href={PATH_AUTH.signup}
                className={`block w-full rounded-full py-3 text-center text-sm font-medium transition-colors ${
                  tier.highlighted
                    ? 'bg-[#5044E5] text-white hover:bg-[#4038c9]'
                    : 'border border-gray-200 text-gray-700 hover:border-[#5044E5] hover:text-[#5044E5] dark:border-gray-700 dark:text-gray-200'
                } ${tier.note ? 'mb-2.5' : ''}`}
              >
                {tier.cta}
              </NextLink>

              {tier.note && (
                <p className="text-center text-xs text-gray-500 dark:text-gray-400">{tier.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PricingSection;
