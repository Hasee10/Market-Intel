'use client';

// The agency.ai template's signature card (its ServicesCard): a bordered
// shell with a large blurred blue->indigo->purple blob that follows the
// cursor inside the card and fades in on hover, plus the inner panel's
// subtle padding shift so the border appears to breathe.
//
// Rebuilt rather than imported: the template's version is a .jsx using
// framer-motion for entrance, which this app can't adopt (framer-motion is
// pinned to 4.x for Chakra - see LandingHero). Entrance uses Reveal instead;
// the glow itself is plain React state, exactly as the original.

import { useRef, useState, type ReactNode } from 'react';

export function GlowCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onMouseMove={(e) => {
        const bounds = ref.current?.getBoundingClientRect();
        if (!bounds) return;
        setPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
      }}
      className={`relative overflow-hidden rounded-xl border border-gray-200 shadow-2xl shadow-gray-100 dark:border-gray-700 dark:shadow-white/10 ${className}`}
    >
      <div
        aria-hidden="true"
        style={{ top: position.y - 150, left: position.x - 150 }}
        className={`pointer-events-none absolute z-0 size-[300px] rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 blur-2xl transition-opacity duration-500 mix-blend-lighten ${
          visible ? 'opacity-70' : 'opacity-0'
        }`}
      />
      <div className="relative z-10 h-full rounded-[10px] bg-white p-8 transition-all hover:m-0.5 hover:p-[1.875rem] dark:bg-gray-900">
        {children}
      </div>
    </div>
  );
}

export default GlowCard;
