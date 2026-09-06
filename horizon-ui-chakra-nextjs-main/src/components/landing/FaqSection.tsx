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
// Pressing a question opens the answer as its own raised container - a card
// with its own ground, ring and glow, tethered to the question by a notch -
// rather than the plain inline paragraph this used to expand to. On the deep
// navy panel the whole list sits on, an answer that only differed from its
// question by text colour did not read as an answer at all.

import { useState } from 'react';

import { FAQS } from '@/lib/ai/assistant-knowledge';
import { SectionTitle } from '@/components/landing/SectionTitle';
import { Reveal } from 'components/reactbits/Reveal';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="font-manrope flex w-full flex-col items-center gap-7 px-4 pt-24 text-gray-700 sm:px-12 lg:px-24 xl:px-40 dark:text-white">
      <SectionTitle
        title="Questions, answered"
        desc="The things sellers ask before signing up. Still stuck? The assistant bottom-right knows the same answers."
      />

      <Reveal>
        <div className="relative w-full max-w-3xl overflow-hidden rounded-[28px] bg-[#111C4E] p-4 ring-1 ring-white/10 sm:p-6 md:p-8 dark:bg-[#151E4A]">
          {/* Two soft lights behind the list, borrowed from the loop panel so
              the two dark cards on this site read as the same material. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-[radial-gradient(circle,rgba(123,97,255,0.22)_0%,rgba(123,97,255,0)_70%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(80,68,229,0.18)_0%,rgba(80,68,229,0)_70%)]"
          />

          <div className="relative flex flex-col gap-2.5">
            {FAQS.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <div key={faq.q}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${i}`}
                    className={`flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3.5 text-left ring-1 transition-all duration-200 sm:px-5 ${
                      isOpen
                        ? 'bg-white/[0.12] ring-[#7B61FF]/60'
                        : 'bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span
                      className={`text-[15px] transition-colors ${
                        isOpen ? 'font-semibold text-white' : 'font-medium text-white/85'
                      }`}
                    >
                      {faq.q}
                    </span>
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                        isOpen ? 'rotate-45 bg-[#7B61FF] text-white' : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {/* A plus that rotates into a cross - one glyph, no icon
                          swap, so the transition is continuous. */}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        className="size-3.5"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </button>

                  {/* grid-rows 0fr -> 1fr animates to the answer's real height
                      without measuring it in JS or hardcoding a max-height
                      that would clip the longer answers. */}
                  <div
                    id={`faq-answer-${i}`}
                    role="region"
                    className={`grid transition-all duration-300 ease-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="relative ml-4 mt-2.5 rounded-xl bg-white/[0.07] px-4 py-3.5 ring-1 ring-[#7B61FF]/25 shadow-[0_10px_34px_rgba(10,16,45,0.5)] sm:ml-6 sm:px-5">
                        {/* The notch tethering the container to the question
                            above it, so it reads as this question's answer
                            rather than a loose card in the stack. */}
                        <span
                          aria-hidden="true"
                          className="absolute -top-[5px] left-6 size-2.5 rotate-45 rounded-[2px] bg-[#1B2455] ring-1 ring-[#7B61FF]/25 [clip-path:polygon(0_0,100%_0,0_100%)]"
                        />
                        <p className="text-sm leading-relaxed text-white/75">{faq.a}</p>
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
