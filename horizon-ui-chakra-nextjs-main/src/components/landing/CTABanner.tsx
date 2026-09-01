'use client';

import NextLink from 'next/link';
import { MdArrowForward } from 'react-icons/md';

import { PATH_AUTH } from '@/lib/paths';

export function CTABanner() {
  return (
    <div className="font-manrope py-12 md:py-[70px]">
      <div className="mx-auto max-w-[1200px] px-5 md:px-[30px]">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#5044E5] to-[#7B61FF] px-7 py-12 md:px-16 md:py-16">
          {/* Decorative dot grid + glow so this reads as a designed card,
              not a flat dead block of colour. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex flex-col items-center justify-between gap-7 md:flex-row">
            <div className="text-center md:text-left">
              <h2 className="text-[28px] font-medium tracking-[-0.02em] text-white md:text-4xl">
                Ready to see where you stand?
              </h2>
              <p className="mt-2.5 text-sm text-white/70 md:text-base">
                Free on your own store data. No credit card, no sales call.
              </p>
            </div>
            <NextLink
              href={PATH_AUTH.signup}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-medium text-[#111C4E] transition-transform hover:-translate-y-0.5"
            >
              Start free
              <MdArrowForward className="size-5" aria-hidden="true" />
            </NextLink>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CTABanner;
