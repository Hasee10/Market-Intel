'use client';

import NextLink from 'next/link';
import { MdCheckCircle } from 'react-icons/md';

import { PATH_AUTH } from '@/lib/paths';
import { MARKETPLACE_COUNT } from '@/lib/marketplaces';
import { Reveal } from 'components/reactbits/Reveal';

// Rebuilt to follow the agency.ai landing template's hero: single centred
// column, oversized medium-weight headline with one gradient-filled word,
// pill badge above, and the product visual below the copy rather than beside
// it. The previous two-column split was Horizon's layout, not the template's.
//
// Entrance animation uses this repo's existing Reveal rather than the
// template's framer-motion `whileInView` - that prop landed in framer-motion
// 6, and this app is pinned to 4.x because Chakra 2.6 peer-depends on it.
// Same staggered fade-and-rise, no dependency risk.

// Organic blurred blob shapes behind the illustration - the illustration
// itself has a transparent canvas, so these show through and give the
// composition depth instead of the artwork floating on flat white.
function DecorativeBlobs() {
  return (
    <>
      <div className="pointer-events-none absolute -top-16 right-0 size-[360px] rounded-full bg-[radial-gradient(circle,rgba(67,24,255,0.16)_0%,rgba(67,24,255,0)_70%)] blur-[2px] lg:-right-10" />
      <div className="pointer-events-none absolute -bottom-10 left-0 size-[220px] rounded-full bg-[radial-gradient(circle,rgba(5,205,153,0.16)_0%,rgba(5,205,153,0)_70%)] lg:-left-8" />
    </>
  );
}

const TRUST_LINES = ['Free on your own store data', 'No credit card required'];

export function LandingHero() {
  return (
    <section className="font-manrope w-full overflow-hidden px-4 py-20 text-center sm:px-12 lg:px-24 xl:px-40">
      <Reveal>
        <span className="inline-flex items-center gap-2 rounded-full border border-gray-300 py-1.5 pl-1.5 pr-4 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300">
          <span className="rounded-full bg-[#EEF0FF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#3641F5] dark:bg-gray-800 dark:text-[#A594FF]">
            For online sellers
          </span>
          Now tracking {MARKETPLACE_COUNT} marketplaces
        </span>
      </Reveal>

      <Reveal delay={80}>
        <h1 className="mx-auto mt-6 max-w-5xl text-4xl font-medium leading-tight tracking-[-0.03em] text-gray-800 sm:text-5xl md:text-6xl xl:text-[76px] xl:leading-[1.05] dark:text-white">
          See your market. Not just your{' '}
          <span className="bg-gradient-to-r from-[#4318FF] to-[#7592FF] bg-clip-text text-transparent">
            store
          </span>
          .
        </h1>
      </Reveal>

      <Reveal delay={160}>
        <p className="mx-auto mt-6 max-w-2xl text-sm font-medium text-gray-500 sm:text-lg dark:text-white/75">
          Ryvl tracks competitor pricing across {MARKETPLACE_COUNT} marketplaces, benchmarks you
          against anonymized peers in your category, and tells you when to act &mdash; pricing
          recommendations, stock-out signals, and price alerts included.
        </p>
      </Reveal>

      <Reveal delay={240}>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
          <NextLink
            href={PATH_AUTH.signup}
            className="rounded-full bg-[#4318FF] px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-[#3812DB]"
          >
            Start free
          </NextLink>
          <NextLink
            href="/#features"
            className="rounded-full border border-gray-300 px-8 py-3.5 text-base font-medium text-gray-700 transition-colors hover:border-[#4318FF] hover:text-[#4318FF] dark:border-gray-700 dark:text-gray-200"
          >
            See how it works
          </NextLink>
        </div>
      </Reveal>

      <Reveal delay={300}>
        <div className="mt-5 flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-6">
          {TRUST_LINES.map((line) => (
            <span key={line} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              <MdCheckCircle className="size-3.5 text-green-400" aria-hidden="true" />
              {line}
            </span>
          ))}
        </div>
      </Reveal>

      <Reveal delay={380}>
        <div className="relative mx-auto mt-12 max-w-4xl">
          <DecorativeBlobs />
          {/* Plain <img>, not next/image - it refuses local SVGs unless
              images.dangerouslyAllowSVG is set in next.config.js, which isn't
              worth adding config surface for one trusted local asset that
              doesn't need srcset/lazy-loading anyway. */}
          <img
            src="/assets/ryvl-hero-illustration-vector.svg"
            alt="Seller comparing their store's pricing against market benchmarks on Ryvl"
            width={1500}
            height={1000}
            className="relative z-10 h-auto w-full"
          />
        </div>
      </Reveal>
    </section>
  );
}

export default LandingHero;
