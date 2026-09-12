'use client';

import { useEffect, useState } from 'react';

// Local replacement for Chakra's hook of the same name, so components can
// respect the OS motion preference without pulling in Chakra. Written for the
// migration: it's the last thing several ported components still needed
// Chakra for.
//
// Defaults to `false` on the server and first client render, then corrects
// after mount - the media query can't be read during SSR, and defaulting to
// "reduce motion" would mean everyone briefly sees the static variant before
// animation appears, which is a worse flash than the reverse.
const QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(QUERY);
    setPrefersReducedMotion(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  return prefersReducedMotion;
}

export default usePrefersReducedMotion;
