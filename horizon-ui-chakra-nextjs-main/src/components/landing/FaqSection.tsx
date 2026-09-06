'use client';

// Fills the slot the template uses for "Meet the team" - a section Ryvl has
// no honest content for (and where that template ships real strangers'
// names and photos).
//
// The questions are NOT written for this page: they are the same FAQS the
// marketing assistant is grounded in (lib/ai/assistant-knowledge.ts), so the
// page and the chat widget can never give different answers to the same
// question. Add one there and it appears in both.
//
// Laid out as a ring rather than a stack: press a topic on the circle and its
// question and answer appear in the container at the centre. Ten nodes is
// exactly what a circle can hold at a readable size, which is why the node
// carries the two-word `topic` and the full question lives in the middle with
// the answer it belongs to.
//
// Theme-aware, not a fixed dark stage like ShowcaseSection's device frames -
// asked and answered explicitly: a panel that never changes with the toggle
// reads as a dark island dropped on a light page in light mode, and nothing
// about pressing the toggle actually fixes that (only the page around it
// goes dark, coincidentally reducing the contrast). Every colour below has a
// light and a dark side instead.

import { useState } from 'react';
import { useColorMode } from '@chakra-ui/react';

import { FAQS } from '@/lib/ai/assistant-knowledge';
import { SectionTitle } from '@/components/landing/SectionTitle';
import { Reveal } from 'components/reactbits/Reveal';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

/** Ring radius as a percentage of the (square) stage. */
const RADIUS = 40;

const ANGLES = FAQS.map((_, i) => -90 + i * (360 / FAQS.length));

const POSITIONS = ANGLES.map((degrees) => {
  const radians = (degrees * Math.PI) / 180;
  return {
    left: 50 + RADIUS * Math.cos(radians),
    top: 50 + RADIUS * Math.sin(radians),
  };
});

export function FaqSection() {
  const prefersReducedMotion = usePrefersReducedMotion();
  // Only the two raw SVG stroke attributes below need this - every other
  // colour on this page is a Tailwind class and already answers to `dark:`
  // on its own. An attribute value can't take a CSS variant, so those two
  // read the mode directly instead.
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const [active, setActive] = useState(0);
  const faq = FAQS[active];

  return (
    <section className="font-manrope flex w-full flex-col items-center gap-7 px-4 pt-24 text-gray-700 sm:px-12 lg:px-24 xl:px-40 dark:text-white">
      <SectionTitle
        title="Questions, answered"
        desc="Press a topic on the ring. Still stuck? The assistant bottom-right knows the same answers."
      />

      {/* Two columns at md+ (the same breakpoint the ring/list switch already
          uses): the interactive card on the left, the supplied illustration
          on the right, vertically centred against each other. Below md
          there's exactly one column, so DOM order alone puts the FAQ card
          first and the illustration second - no order-* classes needed.
          max-w-6xl caps the pair on very wide screens; w-full on the Reveal
          is still load-bearing for the same reason it always was - see the
          ring stage's own comment below. */}
      <Reveal className="w-full">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 md:grid-cols-2 md:gap-6 lg:gap-14">
          <div className="relative w-full overflow-hidden rounded-[28px] bg-white p-4 ring-1 ring-gray-200 sm:p-6 md:p-8 dark:bg-[#151E4A] dark:ring-white/10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-[radial-gradient(circle,rgba(123,97,255,0.16)_0%,rgba(123,97,255,0)_70%)] dark:bg-[radial-gradient(circle,rgba(123,97,255,0.22)_0%,rgba(123,97,255,0)_70%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-32 -left-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(80,68,229,0.12)_0%,rgba(80,68,229,0)_70%)] dark:bg-[radial-gradient(circle,rgba(80,68,229,0.18)_0%,rgba(80,68,229,0)_70%)]"
            />

            {/* The ring. Hidden below lg, not md - the two-column grid this
                card sits in (md:grid-cols-2) already halves the available
                width at md, and measured in the browser at exactly 768px the
                stage shrinks to ~252px, which has no room left for the
                centre answer box to hold even a trimmed answer without
                scrolling (verified: every one of the ten overflowed at that
                size). lg is where a column is wide enough for the ring to
                actually work; between md and lg, the list below stands in
                for it - still a two-column "side by side" layout per the
                brief, just with the list on the left instead of the ring
                until there's room for one. */}
            <div className="relative mx-auto hidden aspect-square w-full max-w-[620px] lg:block">
              <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
                <defs>
                  <linearGradient id="faq-sweep" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#7B61FF" stopOpacity="0" />
                    <stop offset="100%" stopColor="#A594FF" stopOpacity="0.85" />
                  </linearGradient>
                </defs>

              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={isDark ? '#ffffff' : '#111C4E'}
                strokeOpacity={isDark ? '0.13' : '0.12'}
                strokeWidth="0.4"
              />

              {!prefersReducedMotion && (
                <g
                  className="animate-[loop-spin_18s_linear_infinite]"
                  style={{ transformBox: 'view-box', transformOrigin: '50px 50px' }}
                >
                  <circle
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    fill="none"
                    stroke="url(#faq-sweep)"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                    strokeDasharray="30 220"
                  />
                </g>
              )}

              {/* Spoke from the selected topic to the container in the middle,
                  so the answer is visibly tethered to the node you pressed. */}
              <line
                x1={50 + (RADIUS - 4) * Math.cos((ANGLES[active] * Math.PI) / 180)}
                y1={50 + (RADIUS - 4) * Math.sin((ANGLES[active] * Math.PI) / 180)}
                x2={50 + 25 * Math.cos((ANGLES[active] * Math.PI) / 180)}
                y2={50 + 25 * Math.sin((ANGLES[active] * Math.PI) / 180)}
                stroke="#7B61FF"
                strokeOpacity="0.55"
                strokeWidth="0.5"
              />
            </svg>

            {/* The container that appears when a topic is pressed. Sized to
                its own content (not size-full of the bounding box) - a fixed
                square left a dead gap under every answer shorter than the
                longest one. 58%, not the original 47%: even after trimming
                every FAQS answer down (lib/ai/assistant-knowledge.ts), the
                longest ones still needed more room than 47% gave at the
                ring's smallest real size, verified by measuring
                scrollHeight vs clientHeight for all ten topics in the
                browser at 1024px (the lg breakpoint the ring now starts at -
                see its own comment above). 58% still clears every node:
                half-diagonal is ~41% of the stage vs the ring's own 40%
                radius, and the nodes sit further out than their own centre
                by roughly their half-width. No responsive step here (unlike
                the topic buttons) - the ring only ever renders at lg+ now,
                so a size tuned for anything narrower would never actually
                be seen. */}
            <div className="absolute left-1/2 top-1/2 flex size-[58%] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
              <div className="max-h-full min-h-[100px] w-full overflow-y-auto rounded-2xl bg-brand-50 px-5 py-4 text-center ring-1 ring-[#7B61FF]/20 shadow-[0_14px_40px_rgba(10,16,45,0.12)] dark:bg-white/[0.08] dark:ring-[#7B61FF]/30 dark:shadow-[0_14px_40px_rgba(10,16,45,0.55)]">
                {/* Keyed so the content remounts and replays its entrance
                    every time a different topic is pressed. */}
                <div key={active} className="animate-[faq-pop_220ms_ease-out]">
                  <p className="text-[15px] font-semibold leading-snug text-gray-900 dark:text-white">{faq.q}</p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-gray-600 dark:text-white/75">{faq.a}</p>
                </div>
              </div>
            </div>

            {FAQS.map((item, i) => {
              const isActive = i === active;
              return (
                <button
                  key={item.q}
                  type="button"
                  onClick={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  aria-current={isActive}
                  aria-label={item.q}
                  style={{ left: `${POSITIONS[i].left}%`, top: `${POSITIONS[i].top}%` }}
                  className={`absolute w-[104px] -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-center text-xs ring-1 backdrop-blur-sm transition-all duration-200 lg:w-[116px] lg:text-[13px] ${
                    isActive
                      ? 'bg-brand-50 font-semibold text-[#111C4E] shadow-[0_0_28px_rgba(123,97,255,0.35)] ring-[#7B61FF]/60 dark:bg-white/[0.16] dark:text-white dark:shadow-[0_0_28px_rgba(123,97,255,0.45)] dark:ring-[#7B61FF]/70'
                      : 'bg-gray-50 font-medium text-gray-600 ring-gray-200 hover:bg-gray-100 hover:text-gray-900 dark:bg-white/[0.06] dark:text-white/70 dark:ring-white/10 dark:hover:bg-white/[0.12] dark:hover:text-white'
                  }`}
                >
                  {item.topic}
                </button>
              );
            })}
          </div>

          {/* Below lg: the same ten, as a list - see the ring's own comment
              above for why this now runs through the whole md..lg range,
              not just below md. */}
          <div className="flex flex-col gap-2.5 lg:hidden">
            {FAQS.map((item, i) => {
              const isOpen = i === active;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setActive(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    className={`flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3.5 text-left ring-1 transition-all duration-200 ${
                      isOpen
                        ? 'bg-brand-50 ring-[#7B61FF]/50 dark:bg-white/[0.12] dark:ring-[#7B61FF]/60'
                        : 'bg-gray-50 ring-gray-200 dark:bg-white/[0.04] dark:ring-white/10'
                    }`}
                  >
                    <span
                      className={`text-[15px] ${
                        isOpen
                          ? 'font-semibold text-gray-900 dark:text-white'
                          : 'font-medium text-gray-600 dark:text-white/85'
                      }`}
                    >
                      {item.q}
                    </span>
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                        isOpen
                          ? 'rotate-45 bg-[#7B61FF] text-white'
                          : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/60'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-3.5">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </button>

                  <div
                    className={`grid transition-all duration-300 ease-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-4 mt-2.5 rounded-xl bg-brand-50 px-4 py-3.5 ring-1 ring-[#7B61FF]/20 dark:bg-white/[0.07] dark:ring-[#7B61FF]/25">
                        <p className="text-sm leading-relaxed text-gray-600 dark:text-white/75">{item.a}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>

          {/* The supplied illustration, rendered as an image asset per the
              brief - not rebuilt in markup like the rest of this file's
              SVGs. Its own artwork already carries a soft shadow and a
              lavender card mock (ryvl-faq-illustration.svg), so it sits
              directly on the section's background rather than inside a
              second bordered card, which would double-frame it. Sized down
              at md (tablet) and back up at lg (desktop) per the brief;
              mx-auto centres it under its own cap on every breakpoint where
              that cap is narrower than the column. */}
          <div className="relative mx-auto aspect-[1600/1000] w-full max-w-[360px] md:max-w-[300px] lg:max-w-[460px]">
            {/* Plain <img>, not next/image - the optimizer refuses to serve
                any SVG (local or remote) unless dangerouslyAllowSVG is set
                globally in next.config.js, and that flag isn't worth
                widening for one trusted local asset. Same escape hatch
                LogoTile.tsx already uses for the same reason. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/ryvl-faq-illustration.svg"
              alt="A seller reviewing answers to frequently asked questions"
              className="absolute inset-0 size-full object-contain"
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default FaqSection;
