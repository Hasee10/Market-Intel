'use client';

// Fills the slot the template uses for "Meet the team" - a section Ryvl has
// no honest content for (and where that template ships real strangers'
// names and photos).
//
// The questions are NOT written for this page: they are the same FAQS the
// marketing assistant is grounded in (lib/ai/assistant-knowledge.ts), so the
// page and the chat widget can never give different answers to the same
// question. Add one there and it appears in both.

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

      <div className="w-full max-w-3xl">
        {FAQS.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <Reveal key={faq.q} delay={Math.min(i, 4) * 70}>
              <div className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-[15px] font-medium text-gray-900 dark:text-white">
                    {faq.q}
                  </span>
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                      isOpen
                        ? 'rotate-45 bg-[#5044E5] text-white'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {/* A plus that rotates into a cross - one glyph, no icon
                        swap, so the transition is continuous. */}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-3.5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>

                <div
                  className={`grid transition-all duration-200 ease-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm leading-relaxed text-gray-600 dark:text-white/70">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export default FaqSection;
