'use client';

import { Box, useColorModeValue, usePrefersReducedMotion } from '@chakra-ui/react';
import { useCallback, useRef } from 'react';
import type { MouseEventHandler, PropsWithChildren } from 'react';

import Card from 'components/card/Card';

// Cursor-tracked spotlight, adapted from React Bits' SpotlightCard
// (reactbits.dev, MIT + Commons Clause) to Chakra.
//
// The original ships as a plain <div> with hardcoded dark colours and its own
// border-radius/background. That would have fought Horizon's Card theme, so
// this wraps our themed <Card> instead and only contributes the ::before
// gradient layer - radius, padding and background still come from
// theme/additions/card/card.ts. Nothing about the card's box model changes.
//
// Deliberately zero-dependency: the effect is a radial-gradient reading two
// CSS custom properties, so the mousemove handler only calls
// style.setProperty and never triggers a React re-render. That keeps it off
// the render path entirely, which matters on the dashboard where a dozen of
// these can be mounted at once.

type SpotlightCardProps = PropsWithChildren<{
  /** Overrides the theme-derived spotlight tint. Any valid CSS colour. */
  spotlightColor?: string;
  /** Renders as a plain Box instead of a themed Card. */
  unstyled?: boolean;
}> &
  Record<string, unknown>;

export function SpotlightCard({
  children,
  spotlightColor,
  unstyled = false,
  ...rest
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Brand-tinted in light mode, cool white in dark - a white spotlight on the
  // light theme's white card is invisible, which is why this is not a single
  // hardcoded colour like the original.
  const themeSpotlight = useColorModeValue(
    'rgba(66, 42, 251, 0.10)',
    'rgba(117, 81, 255, 0.22)',
  );
  const color = spotlightColor ?? themeSpotlight;

  const handleMouseMove = useCallback<MouseEventHandler<HTMLDivElement>>((event) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--spotlight-x', `${event.clientX - rect.left}px`);
    node.style.setProperty('--spotlight-y', `${event.clientY - rect.top}px`);
  }, []);

  // A spotlight that tracks the pointer is decorative motion; honouring the
  // OS-level reduced-motion setting means shipping the card untouched.
  if (prefersReducedMotion) {
    const Plain = unstyled ? Box : Card;
    return <Plain {...rest}>{children}</Plain>;
  }

  const spotlightSx = {
    position: 'relative',
    overflow: 'hidden',
    '--spotlight-x': '50%',
    '--spotlight-y': '50%',
    _before: {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderRadius: 'inherit',
      background: `radial-gradient(600px circle at var(--spotlight-x) var(--spotlight-y), ${color}, transparent 70%)`,
      opacity: 0,
      transition: 'opacity 0.4s ease',
      pointerEvents: 'none',
      // Sits above the card background but below its content, so text stays
      // fully legible through the gradient.
      zIndex: 0,
    },
    // focus-within keeps the effect reachable for keyboard users, matching the
    // original's behaviour.
    '&:hover::before, &:focus-within::before': { opacity: 1 },
    // Content needs its own stacking context, otherwise the ::before layer
    // paints over it.
    '& > *': { position: 'relative', zIndex: 1 },
  } as const;

  if (unstyled) {
    return (
      <Box ref={ref} onMouseMove={handleMouseMove} sx={spotlightSx} {...rest}>
        {children}
      </Box>
    );
  }

  return (
    <Card ref={ref} onMouseMove={handleMouseMove} sx={spotlightSx} {...rest}>
      {children}
    </Card>
  );
}

export default SpotlightCard;
