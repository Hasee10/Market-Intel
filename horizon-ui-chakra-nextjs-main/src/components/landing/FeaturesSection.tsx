'use client';

import {
  MdBarChart,
  MdOutlineVisibility,
  MdNotificationsActive,
  MdAttachMoney,
  MdGroup,
  MdOutlineShoppingCart,
} from 'react-icons/md';

import { Reveal } from 'components/reactbits/Reveal';
import { MARKETPLACE_COUNT } from '@/lib/marketplaces';

// Every feature here maps to something actually shipped in the product
// (see lib/market-intel/*.ts) - not aspirational marketing copy for
// features that don't exist yet.
//
// `wide` marks the two differentiators - the market data nobody else gives a
// Pakistani seller, and the recommendation built on top of it. A flat 3x2 grid
// gave all six equal weight, which buried them next to "orders, products,
// customers". They keep the double-width tiles and the bold gradient icon so
// the section has a reading order instead of six identical boxes.
const FEATURES = [
  {
    icon: MdOutlineVisibility,
    title: 'Live competitor tracking',
    description: `Pricing and stock data scraped from ${MARKETPLACE_COUNT} marketplaces, refreshed automatically - category-wide pricing bands, stock-outs, and platform-reported sold-count proxies where available.`,
    wide: true,
  },
  {
    icon: MdBarChart,
    title: 'Peer benchmarking',
    description:
      'See where your pricing, order volume, and repeat-purchase rate sit against anonymized sellers in your own category.',
  },
  {
    icon: MdNotificationsActive,
    title: 'Watchlists & price alerts',
    description:
      'Track specific competitor products and get notified the moment their price or stock status changes.',
  },
  {
    icon: MdGroup,
    title: 'Churn & retention insights',
    description:
      'RFM-scored at-risk customer lists and retention/repeat-purchase metrics, computed from your own order history.',
  },
  {
    icon: MdOutlineShoppingCart,
    title: 'Orders, products, customers',
    description:
      'The operational basics in one place, with CSV bulk import so you are not retyping your existing catalog by hand.',
  },
  {
    icon: MdAttachMoney,
    title: 'Pricing recommendations',
    description:
      'A rule-based recommendation that keeps you inside the competitive band without dropping below your own margin floor.',
    wide: true,
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="font-manrope relative overflow-hidden bg-white py-20 md:py-[120px] dark:bg-gray-950"
    >
      {/* Ambient glow so the section isn't a flat white slab behind white
          cards - without it there's no depth between card and page. */}
      <div className="pointer-events-none absolute left-[-160px] top-[10%] size-[420px] rounded-full bg-[radial-gradient(circle,rgba(67,24,255,0.06)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-[5%] right-[-180px] size-[460px] rounded-full bg-[radial-gradient(circle,rgba(67,24,255,0.06)_0%,transparent_70%)]" />

      <div className="relative mx-auto max-w-[1200px] px-5 md:px-[30px]">
        <Reveal>
          <div className="mb-12 text-center md:mb-[72px]">
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#4318FF] dark:text-[#A594FF]">
              What you get
            </p>
            <h2 className="mx-auto mt-3 max-w-[20ch] text-[28px] font-medium tracking-[-0.02em] text-[#111C4E] md:text-[40px] dark:text-white">
              Everything you need to sell with your eyes open
            </h2>
            <p className="mx-auto mt-4 max-w-[560px] text-lg text-gray-600 dark:text-gray-400">
              Your own store analytics, plus the market context that most sellers never get to see.
            </p>
          </div>
        </Reveal>

        {/* 4-column bento on desktop: the two `wide` tiles take half a row each
            and sit on opposite rows, so the grid reads as a composition rather
            than six identical boxes. Collapses to 2-up on tablet, 1-up on
            mobile. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal
                key={feature.title}
                delay={index * 70}
                className={feature.wide ? 'sm:col-span-2' : ''}
              >
                <div
                  className={`group h-full rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    feature.wide
                      ? 'border-[#E4DEFF] bg-gradient-to-br from-[#F7F5FF] to-white dark:border-gray-800 dark:from-gray-900 dark:to-gray-950'
                      : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
                  }`}
                >
                  <div
                    className={`mb-4 flex size-11 items-center justify-center rounded-xl ${
                      feature.wide
                        ? 'bg-gradient-to-br from-[#4318FF] to-[#7592FF] text-white'
                        : 'border border-[#E4DEFF] bg-[#F0EDFF] text-[#4318FF] dark:border-gray-700 dark:bg-gray-800 dark:text-[#A594FF]'
                    }`}
                  >
                    <Icon className="size-[22px]" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-[#111C4E] dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    {feature.description}
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

export default FeaturesSection;
