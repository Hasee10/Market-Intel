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

import { useState } from 'react';

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
  const [active, setActive] = useState(0);
  const faq = FAQS[active];

  return (
    <section className="font-manrope flex w-full flex-col items-center gap-7 px-4 pt-24 text-gray-700 sm:px-12 lg:px-24 xl:px-40 dark:text-white">
      <SectionTitle
        title="Questions, answered"
        desc="Press a topic on the ring. Still stuck? The assistant bottom-right knows the same answers."
      />

      {/* w-full on the Reveal is load-bearing, not cosmetic: this section is a
          centred flex column, so its children size to their content. Every
          node in the ring below is absolutely positioned and contributes no
          intrinsic width, so without a definite width here the stage measures
          0, and aspect-square then makes it 0 tall - the whole card collapses. */}
      <Reveal className="w-full">
        <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[28px] bg-[#111C4E] p-4 ring-1 ring-white/10 sm:p-6 md:p-8 dark:bg-[#151E4A]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-[radial-gradient(circle,rgba(123,97,255,0.22)_0%,rgba(123,97,255,0)_70%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(80,68,229,0.18)_0%,rgba(80,68,229,0)_70%)]"
          />

          {/* The ring. Hidden below md - ten nodes on a 375px circle is not a
              readable layout at any font size, so small screens get the list
              underneath instead. */}
          <div className="relative mx-auto hidden aspect-square w-full max-w-[620px] md:block">
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
              <defs>
                <linearGradient id="faq-sweep" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7B61FF" stopOpacity="0" />
                  <stop offset="100%" stopColor="#A594FF" stopOpacity="0.85" />
                </linearGradient>
              </defs>

              <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#ffffff" strokeOpacity="0.13" strokeWidth="0.4" />

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
                its own content (not size-full of the 47% bounding box) - a
                fixed square left a dead gap under every answer shorter than
                the longest one. The bounding box still caps how big it can
                get, so the longest answer scrolls instead of colliding with
                the ring. */}
            <div className="absolute left-1/2 top-1/2 flex size-[47%] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
              <div className="max-h-full min-h-[110px] w-full overflow-y-auto rounded-2xl bg-white/[0.08] px-5 py-4 text-center ring-1 ring-[#7B61FF]/30 shadow-[0_14px_40px_rgba(10,16,45,0.55)]">
                {/* Keyed so the content remounts and replays its entrance
                    every time a different topic is pressed. */}
                <div key={active} className="animate-[faq-pop_220ms_ease-out]">
                  <p className="text-[15px] font-semibold leading-snug text-white">{faq.q}</p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-white/75">{faq.a}</p>
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
                      ? 'bg-white/[0.16] font-semibold text-white shadow-[0_0_28px_rgba(123,97,255,0.45)] ring-[#7B61FF]/70'
                      : 'bg-white/[0.06] font-medium text-white/70 ring-white/10 hover:bg-white/[0.12] hover:text-white'
                  }`}
                >
                  {item.topic}
                </button>
              );
            })}
          </div>

          {/* Below md: the same ten, as a list. */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {FAQS.map((item, i) => {
              const isOpen = i === active;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setActive(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    className={`flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3.5 text-left ring-1 transition-all duration-200 ${
                      isOpen ? 'bg-white/[0.12] ring-[#7B61FF]/60' : 'bg-white/[0.04] ring-white/10'
                    }`}
                  >
                    <span
                      className={`text-[15px] ${isOpen ? 'font-semibold text-white' : 'font-medium text-white/85'}`}
                    >
                      {item.q}
                    </span>
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                        isOpen ? 'rotate-45 bg-[#7B61FF] text-white' : 'bg-white/10 text-white/60'
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
                      <div className="ml-4 mt-2.5 rounded-xl bg-white/[0.07] px-4 py-3.5 ring-1 ring-[#7B61FF]/25">
                        <p className="text-sm leading-relaxed text-white/75">{item.a}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default FaqSection;
