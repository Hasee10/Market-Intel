'use client';

// The template's Title component: a centred medium-weight heading with a
// constrained muted sub-line under it. Every section on the marketing site
// uses this rather than each rolling its own heading sizes.

import { Reveal } from 'components/reactbits/Reveal';

export function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center">
      <Reveal>
        <h2 className="mb-3 text-center text-3xl font-medium text-gray-700 sm:text-5xl dark:text-white">
          {title}
        </h2>
      </Reveal>
      {desc && (
        <Reveal delay={120}>
          <p className="mb-6 max-w-lg text-center text-gray-500 dark:text-white/75">{desc}</p>
        </Reveal>
      )}
    </div>
  );
}

export default SectionTitle;
