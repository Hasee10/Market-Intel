'use client';

import Image from 'next/image';

import { Reveal } from 'components/reactbits/Reveal';
import { GlowCard } from '@/components/landing/GlowCard';
import { SectionTitle } from '@/components/landing/SectionTitle';
import { TESTIMONIALS, type Testimonial } from '@/components/landing/testimonials';

// Wrapping flex, not CSS columns and not a fixed grid.
//
// Columns were the first attempt and they balance by height, which pushed the
// 7th card to the bottom of the last column and left the layout visibly
// right-heavy. A plain 3-up grid has the same problem from the other
// direction: at 7, 10, 13 entries the final row starts at the left edge with
// dead space beside it. `flex-wrap` + `justify-center` centres whatever the
// last row happens to hold, so an odd count stays balanced as customers are
// added.
//
// Widths are explicit rather than `basis-*` so they can subtract the gap:
// at gap-6 (24px), two across is 50% - 12px and three across is
// 33.333% - 16px (two gaps shared over three cards).
//
// Written out in full, never built with a template literal - Tailwind scans
// source as plain text, so an interpolated class name is a class that never
// reaches the stylesheet.
const CARD_WIDTH = 'sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]';

export function TestimonialsSection() {
  if (TESTIMONIALS.length === 0) return null;

  return (
    <section className="font-manrope flex w-full flex-col items-center gap-7 px-4 pt-24 text-gray-700 sm:px-12 lg:px-24 xl:px-40 dark:text-white">
      <SectionTitle
        title="Trusted by sellers who guard their data"
        desc="Why store owners were willing to connect their numbers to Ryvl."
      />

      {/* list-none is required, not cosmetic: this stylesheet deliberately
          skips Tailwind's preflight (see styles/tailwind.css), so a bare
          <ul> keeps its default disc markers and renders a bullet beside
          every card. */}
      <ul className="flex w-full max-w-6xl list-none flex-wrap justify-center gap-6">
        {TESTIMONIALS.map((testimonial, i) => (
          <li key={testimonial.name} className={`w-full ${CARD_WIDTH}`}>
            <Reveal delay={Math.min(i, 2) * 120} className="h-full">
              <GlowCard className="h-full">
                {/* flex-col + grow on the quote pins every attribution row to
                    the bottom of its card, so names line up across a row
                    instead of floating at whatever height the quote ended. */}
                <figure className="flex h-full flex-col">
                  <QuoteMark />

                  <blockquote className="mt-3 grow text-[0.9375rem] leading-relaxed text-gray-600 dark:text-white/75">
                    {testimonial.quote}
                  </blockquote>

                  <figcaption className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                    <Avatar testimonial={testimonial} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-gray-800 dark:text-white">
                        {testimonial.name}
                      </span>
                      {testimonial.role && (
                        <span className="block truncate text-xs text-gray-500 dark:text-white/60">
                          {testimonial.role}
                        </span>
                      )}
                    </span>
                  </figcaption>
                </figure>
              </GlowCard>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Decorative opening quote. Drawn rather than typed as a " character so it
// doesn't depend on a serif face being loaded to look like anything.
//
// self-start matters: as a stretched flex item it spans the full card width
// and the glyph drifts to the middle instead of opening the quote.
function QuoteMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 18"
      className="h-4 w-auto shrink-0 self-start text-[#5044E5]/30 dark:text-[#A594FF]/40"
      fill="currentColor"
    >
      <path d="M0 18V9.9C0 4.4 3.2.7 8.4 0l.9 2.7C6.6 3.6 5 5.6 5 8.1h3.6V18H0Zm14.7 0V9.9c0-5.5 3.2-9.2 8.4-9.9l.9 2.7c-2.7.9-4.3 2.9-4.3 5.4H23V18h-8.3Z" />
    </svg>
  );
}

// Falls back to initials when a testimonial has no photo, so a customer can
// be added without one instead of shipping a broken image or a stock face
// standing in for a named person.
function Avatar({ testimonial }: { testimonial: Testimonial }) {
  const ring =
    'size-11 shrink-0 rounded-full ring-2 ring-gray-100 dark:ring-gray-800';

  if (testimonial.imageUrl) {
    return (
      <Image
        src={testimonial.imageUrl}
        alt=""
        width={44}
        height={44}
        // Decorative: the name sits next to it in the figcaption, so an alt
        // repeating it would just be read out twice.
        aria-hidden="true"
        className={`${ring} object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${ring} flex items-center justify-center bg-gray-100 text-sm font-bold text-[#5044E5] dark:bg-gray-700 dark:text-[#A594FF]`}
    >
      {initials(testimonial.name)}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default TestimonialsSection;
