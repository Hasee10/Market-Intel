'use client';

import { Box, usePrefersReducedMotion } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';

// Scroll-triggered entrance, adapted from React Bits' AnimatedContent
// (reactbits.dev, MIT + Commons Clause).
//
// The original uses GSAP's ScrollTrigger. Adding GSAP (~70KB gzipped) to
// animate opacity and a 16px translate would be a bad trade on a dashboard,
// so this is a CSS keyframe gated by IntersectionObserver - the same visual
// result with nothing added to the bundle.
//
// `delay` is what makes a grid read as a sequence rather than a pop: pass the
// map index and each tile lands a beat after the one before it.

const riseIn = keyframes({
  from: { opacity: 0, transform: 'translateY(16px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

type RevealProps = PropsWithChildren<{
  /** Stagger offset in ms - typically `index * 60`. */
  delay?: number;
  duration?: number;
}> &
  Record<string, unknown>;

export function Reveal({ children, delay = 0, duration = 550, ...rest }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  // Reduced motion (or no JS yet): render fully visible and static. The
  // content is never hidden behind an animation that might not run.
  if (prefersReducedMotion) {
    return (
      <Box ref={ref} {...rest}>
        {children}
      </Box>
    );
  }

  return (
    <Box
      ref={ref}
      sx={{
        // Pre-animation state. `willChange` is scoped to the animating phase
        // only - leaving it on permanently would pin a compositor layer per
        // tile for the life of the page.
        opacity: visible ? undefined : 0,
        animation: visible ? `${riseIn} ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms both` : undefined,
        willChange: visible ? 'opacity, transform' : undefined,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

export default Reveal;
