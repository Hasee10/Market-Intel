'use client';

import { Box, Container, Flex, Text, usePrefersReducedMotion, useColorModeValue } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

import { LogoTile } from '@/components/landing/LogoTile';
import { Reveal } from 'components/reactbits/Reveal';

// Shared marquee shell for MarketplaceLogoSlider and CompanyLogoSlider -
// same edge-fade/pause-on-hover/reduced-motion behaviour, different label
// and item source. Kept as one component rather than two copies so a future
// tweak to the animation only has to happen once.

const scroll = keyframes({
  from: { transform: 'translateX(0)' },
  to: { transform: 'translateX(-50%)' },
});

export type LogoMarqueeItem = { key: string; name: string; domain?: string };

// Rough pitch (tile width + gap) per item, used only to derive a scroll
// duration - see speedPxPerSecond below.
const ESTIMATED_ITEM_PITCH_PX = 136;
const MIN_DURATION_SECONDS = 22;

export function LogoMarquee({
  label,
  items,
  speedPxPerSecond = 36,
  direction = 'left',
}: {
  label: string;
  items: LogoMarqueeItem[];
  /**
   * Constant scroll speed rather than a fixed duration - a fixed duration
   * made longer item lists (more sellers/brands over time) scroll faster
   * and less readable, since the same duration then has to cover more
   * pixels. Tying speed to distance instead keeps every row equally easy
   * to read regardless of how many logos are in it.
   */
  speedPxPerSecond?: number;
  /** Which way the track scrolls - 'right' just plays the same keyframes in reverse. */
  direction?: 'left' | 'right';
}) {
  const sectionBg = useColorModeValue('white', 'navy.900');
  const labelColor = useColorModeValue('gray.500', 'whiteAlpha.500');
  const edgeFade = useColorModeValue(
    'linear-gradient(90deg, white 0%, transparent 15%, transparent 85%, white 100%)',
    'linear-gradient(90deg, #111C44 0%, transparent 15%, transparent 85%, #111C44 100%)',
  );
  const dividerColor = useColorModeValue('gray.100', 'whiteAlpha.100');
  const prefersReducedMotion = usePrefersReducedMotion();

  if (items.length === 0) return null;

  const durationSeconds = Math.max(
    MIN_DURATION_SECONDS,
    (items.length * ESTIMATED_ITEM_PITCH_PX) / speedPxPerSecond,
  );

  // Duplicated once so the track can loop seamlessly at -50% instead of
  // snapping back to start; skipped entirely under reduced motion, where a
  // static wrapped row reads better than a slider that never moves.
  const track = prefersReducedMotion ? items : [...items, ...items];

  return (
    <Box bg={sectionBg} py={{ base: '40px', md: '56px' }} borderTop="1px solid" borderBottom="1px solid" borderColor={dividerColor}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Reveal>
          <Text
            textAlign="center"
            fontSize="xs"
            fontWeight="700"
            color={labelColor}
            letterSpacing="0.08em"
            textTransform="uppercase"
            mb="28px"
          >
            {label}
          </Text>
        </Reveal>

        <Box position="relative" overflow="hidden" _before={{ content: '""' }}>
          <Box position="absolute" inset="0" bg={edgeFade} zIndex="1" pointerEvents="none" />
          <Flex
            gap="48px"
            align="center"
            w={prefersReducedMotion ? '100%' : 'max-content'}
            flexWrap={prefersReducedMotion ? 'wrap' : 'nowrap'}
            justify={prefersReducedMotion ? 'center' : 'flex-start'}
            animation={
              prefersReducedMotion
                ? undefined
                : `${scroll} ${durationSeconds}s linear infinite${direction === 'right' ? ' reverse' : ''}`
            }
            sx={prefersReducedMotion ? undefined : { '&:hover': { animationPlayState: 'paused' } }}
          >
            {track.map((item, i) => (
              <LogoTile key={`${item.key}-${i}`} name={item.name} domain={item.domain} />
            ))}
          </Flex>
        </Box>
      </Container>
    </Box>
  );
}

export default LogoMarquee;
