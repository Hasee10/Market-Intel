'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, PropsWithChildren } from 'react';

// Scroll-triggered entrance, adapted from React Bits' AnimatedContent
// (reactbits.dev, MIT + Commons Clause).
//
// The original uses GSAP's ScrollTrigger. Adding GSAP (~70KB gzipped) to
// animate opacity and a 16px translate would be a bad trade, so this is a CSS
// keyframe gated by IntersectionObserver - the same visual result with nothing
// added to the bundle. The keyframe itself lives in styles/tailwind.css
// (.reveal-pending / .reveal-in), which has the full story.
//
// `delay` is what makes a grid read as a sequence rather than a pop: pass the
// map index and each tile lands a beat after the one before it.
//
// `immediate` is for above-the-fold content. A normal Reveal is invisible
// until JS runs, which is correct for something you have to scroll to but
// wrong for the first screen - the landing hero wraps six blocks in this, so
// the entire hero used to depend on hydration to become visible at all. An
// immediate Reveal ships its animation class in the server HTML and plays
// purely in CSS, so it completes even if hydration never happens.
//
// Note this is a guarantee that the content *appears without JS*, not that it
// is painted at t=0: the animation still fills backwards through `delay`, so
// a block with delay=380 fades in over its usual beat. The failure mode being
// fixed is the permanently-blank hero, not the stagger, which is intended.

type RevealProps = PropsWithChildren<{
  /** Stagger offset in ms - typically `index * 60`. */
  delay?: number;
  duration?: number;
  /** Skip the observer and animate on mount. Use for above-the-fold content. */
  immediate?: boolean;
}> &
  HTMLAttributes<HTMLDivElement>;

export function Reveal({
  children,
  delay = 0,
  duration = 550,
  immediate = false,
  className,
  style,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Seeded from `immediate` rather than always false, so an immediate Reveal
  // renders visible on the server and never flips state during hydration.
  const [visible, setVisible] = useState(immediate);

  useEffect(() => {
    if (immediate) return;
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
  }, [immediate]);

  return (
    <div
      ref={ref}
      className={[visible ? 'reveal-in' : 'reveal-pending', className].filter(Boolean).join(' ')}
      style={
        {
          '--reveal-duration': `${duration}ms`,
          '--reveal-delay': `${delay}ms`,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      {children}
    </div>
  );
}

export default Reveal;
