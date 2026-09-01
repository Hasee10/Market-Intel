'use client';

import Image from 'next/image';

import { Reveal } from 'components/reactbits/Reveal';
import { GlowCard } from '@/components/landing/GlowCard';
import { SectionTitle } from '@/components/landing/SectionTitle';
import { TESTIMONIALS, type Testimonial } from '@/components/landing/testimonials';

// Masonry columns rather than the fixed md:grid-cols-3 the other landing
// sections use. Two reasons, both about this list specifically: the quotes
// vary from one line to four, so equal-height grid rows would leave the
// short ones half empty; and the count changes as customers are added, where
// a 3-column grid strands a lone card on the last row at 7, 10, 13...
// Columns just reflow.
export function TestimonialsSection() {
  if (TESTIMONIALS.length === 0) return null;

  return (
    <section className="font-manrope flex w-full flex-col items-center gap-7 px-4 pt-24 text-gray-700 sm:px-12 lg:px-24 xl:px-40 dark:text-white">
      <SectionTitle
        title="Trusted by sellers who guard their data"
        desc="Why store owners were willing to connect their numbers to Ryvl."
      />

      <div className="w-full max-w-6xl columns-1 gap-4 sm:columns-2 sm:gap-6 lg:columns-3">
        {TESTIMONIALS.map((testimonial, i) => (
          <Reveal
            key={testimonial.name}
            // Stagger caps at the first row's worth: past that the later
            // cards are below the fold anyway and a growing delay just
            // makes the last one arrive late.
            delay={Math.min(i, 2) * 120}
            className="mb-4 break-inside-avoid sm:mb-6"
          >
            <GlowCard>
              <figure className="flex h-full flex-col">
                <blockquote className="text-sm text-gray-600 dark:text-white/75">
                  {testimonial.quote}
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <Avatar testimonial={testimonial} />
                  <span className="text-sm font-bold">{testimonial.name}</span>
                </figcaption>
              </figure>
            </GlowCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// Falls back to initials when a testimonial has no photo, so a customer can
// be added without one instead of shipping a broken image or a stock face
// standing in for a named person.
function Avatar({ testimonial }: { testimonial: Testimonial }) {
  if (testimonial.imageUrl) {
    return (
      <Image
        src={testimonial.imageUrl}
        alt=""
        width={40}
        height={40}
        // Decorative: the name sits next to it in the figcaption, so an alt
        // repeating it would just be read out twice.
        aria-hidden="true"
        className="size-10 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-[#5044E5] dark:bg-gray-700 dark:text-[#A594FF]"
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
