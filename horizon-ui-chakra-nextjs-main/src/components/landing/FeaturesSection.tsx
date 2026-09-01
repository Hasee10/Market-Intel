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
import { GlowCard } from '@/components/landing/GlowCard';
import { SectionTitle } from '@/components/landing/SectionTitle';
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
      className="font-manrope flex w-full flex-col items-center gap-7 px-4 pt-24 text-gray-700 sm:px-12 lg:px-24 xl:px-40 dark:text-white"
    >
      <SectionTitle
        title="Everything you need to sell with your eyes open"
        desc="Your own store analytics, plus the market context that most sellers never get to see."
      />

      {/* Template's 2-column card grid. The two `wide` differentiators keep
          their emphasis via a gradient icon rather than a wider tile, since
          the template's own grid is a plain 2-up. */}
      <div className="grid w-full max-w-5xl grid-cols-1 md:grid-cols-2">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Reveal key={feature.title} delay={index * 120} className="m-2 sm:m-4">
              <GlowCard className="h-full">
                <div className="flex items-center gap-6">
                  <div
                    className={`flex size-16 shrink-0 items-center justify-center rounded-full ${
                      feature.wide
                        ? 'bg-gradient-to-br from-[#5044E5] to-[#7592FF] text-white'
                        : 'bg-gray-100 text-[#5044E5] dark:bg-gray-700 dark:text-[#A594FF]'
                    }`}
                  >
                    <Icon className="size-7" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{feature.title}</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-white/75">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </GlowCard>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export default FeaturesSection;
