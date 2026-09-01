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
// `lead` marks the two differentiators: the market data nobody else gives a
// Pakistani seller, and the recommendation built on top of it. They span the
// full width and carry a heavier treatment so the section has a reading
// order rather than six equal boxes.
//
// This flag used to exist but do almost nothing - it swapped the icon's
// colour and that was all, with no col-span anywhere, so all six tiles
// rendered identically and the "double-width" the old comment described was
// never actually built. Changing that is the point of this layout.
const FEATURES = [
  {
    icon: MdOutlineVisibility,
    title: 'Live competitor tracking',
    description: `Pricing and stock data scraped from ${MARKETPLACE_COUNT} marketplaces, refreshed automatically - category-wide pricing bands, stock-outs, and platform-reported sold-count proxies where available.`,
    lead: true,
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
    lead: true,
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

      {/* items-start, NOT items-stretch. Stretching every card to the tallest
          in its row left the two-line ones with three lines of dead space
          under the text - the descriptions here run 2 to 4 lines. Cards hug
          their content instead; a one-line difference reads as natural, a
          three-line void reads as broken. */}
      <ul className="grid w-full max-w-5xl list-none grid-cols-1 items-start gap-5 md:grid-cols-2">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          const lead = feature.lead === true;

          return (
            <li key={feature.title} className={lead ? 'md:col-span-2' : undefined}>
              <Reveal delay={Math.min(index, 3) * 100}>
                <GlowCard>
                  {/* The lead tiles get a wash and a corner bloom so they read
                      as a different tier at a glance, before any text is
                      read. Pointer-events-none so neither steals the hover
                      that drives GlowCard's own cursor glow. */}
                  {lead && (
                    <>
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#5044E5]/[0.07] via-transparent to-transparent dark:from-[#A594FF]/[0.09]"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-[#5044E5]/10 blur-3xl dark:bg-[#A594FF]/10"
                      />
                    </>
                  )}

                  <div className={`relative flex items-start ${lead ? 'gap-5' : 'gap-4'}`}>
                    <span
                      aria-hidden="true"
                      className={
                        lead
                          ? 'flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5044E5] to-[#7592FF] text-white shadow-lg shadow-[#5044E5]/30'
                          : 'flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5044E5] dark:bg-white/10 dark:text-[#A594FF]'
                      }
                    >
                      <Icon className={lead ? 'size-7' : 'size-[22px]'} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3
                        className={`font-bold leading-snug text-gray-900 dark:text-white ${
                          lead ? 'text-xl' : 'text-[17px]'
                        }`}
                      >
                        {feature.title}
                      </h3>
                      <p
                        className={`mt-1.5 leading-relaxed text-gray-600 dark:text-white/65 ${
                          lead ? 'max-w-2xl text-[15px]' : 'text-sm'
                        }`}
                      >
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </GlowCard>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default FeaturesSection;
