'use client';

import { Box, useColorModeValue, usePrefersReducedMotion } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import type { PropsWithChildren } from 'react';

// Gradient shimmer, adapted from React Bits' ShinyText (reactbits.dev,
// MIT + Commons Clause).
//
// The original hardcodes a white sheen over #b5b5b5a4, which only works on a
// dark background. Here both the base colour and the sheen come from the
// colour mode, so it reads correctly on Horizon's white cards as well as
// navy.800.
//
// Reserved for genuinely premium surfaces (upgrade prompts, plan badges).
// Applied broadly it would read as a novelty; applied to the one place we are
// asking for money it reads as production polish.

const shine = keyframes({
  from: { backgroundPosition: '200% center' },
  to: { backgroundPosition: '-200% center' },
});

type ShinyTextProps = PropsWithChildren<{
  /** Seconds per sweep. Slower is more expensive-looking. */
  speed?: number;
  disabled?: boolean;
}> &
  Record<string, unknown>;

export function ShinyText({ children, speed = 5, disabled = false, ...rest }: ShinyTextProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const baseColor = useColorModeValue('#422AFB', '#a394ff');
  const sheenColor = useColorModeValue('rgba(17, 4, 122, 0.95)', 'rgba(255, 255, 255, 0.95)');

  const isStatic = disabled || prefersReducedMotion;

  if (isStatic) {
    return (
      <Box as="span" color={baseColor} fontWeight="600" {...rest}>
        {children}
      </Box>
    );
  }

  return (
    <Box
      as="span"
      fontWeight="600"
      sx={{
        display: 'inline-block',
        color: baseColor,
        backgroundImage: `linear-gradient(120deg, transparent 40%, ${sheenColor} 50%, transparent 60%)`,
        backgroundSize: '200% 100%',
        // Clipping the gradient to the glyphs is what makes the sheen travel
        // through the letters instead of behind them.
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        animation: `${shine} ${speed}s linear infinite`,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

export default ShinyText;
