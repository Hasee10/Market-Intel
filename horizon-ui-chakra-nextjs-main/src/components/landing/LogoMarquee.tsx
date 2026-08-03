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

export function LogoMarquee({ label, items, durationSeconds = 28 }: { label: string; items: LogoMarqueeItem[]; durationSeconds?: number }) {
  const sectionBg = useColorModeValue('white', 'navy.900');
  const labelColor = useColorModeValue('gray.500', 'whiteAlpha.500');
  const edgeFade = useColorModeValue(
    'linear-gradient(90deg, white 0%, transparent 8%, transparent 92%, white 100%)',
    'linear-gradient(90deg, #111C44 0%, transparent 8%, transparent 92%, #111C44 100%)',
  );
  const dividerColor = useColorModeValue('gray.100', 'whiteAlpha.100');
  const prefersReducedMotion = usePrefersReducedMotion();

  if (items.length === 0) return null;

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
            animation={prefersReducedMotion ? undefined : `${scroll} ${durationSeconds}s linear infinite`}
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
