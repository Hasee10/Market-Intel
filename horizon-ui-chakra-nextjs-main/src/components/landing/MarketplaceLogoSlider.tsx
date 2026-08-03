'use client';

import { Box, Container, Flex, Text, usePrefersReducedMotion, useColorModeValue } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useState } from 'react';

import { MARKETPLACES } from '@/lib/marketplaces';
import { Reveal } from 'components/reactbits/Reveal';

// Real logos of the marketplaces Ryvl actually scrapes - not customer/user
// logos. There is no public user base to cite yet (see StatsBar's note on
// the same problem), so this is deliberately framed as "who we track," which
// is true today, rather than "who trusts us," which would not be.
//
// Logos come from logo.dev's img API (https://img.logo.dev/<domain>) using
// the publishable token in NEXT_PUBLIC_LOGO_DEV_TOKEN - that key is designed
// to be embedded client-side (it only ever appears in an <img src>, same as
// logo.dev's own docs), unlike the secret key, which is server-only and not
// used by this component.

const scroll = keyframes({
  from: { transform: 'translateX(0)' },
  to: { transform: 'translateX(-50%)' },
});

function LogoTile({ name, domain }: { name: string; domain: string }) {
  const [failed, setFailed] = useState(false);
  const fallbackBg = useColorModeValue('gray.100', 'whiteAlpha.100');
  const fallbackColor = useColorModeValue('gray.500', 'whiteAlpha.600');
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

  if (failed || !token) {
    return (
      <Flex
        align="center"
        justify="center"
        h="36px"
        px="16px"
        borderRadius="8px"
        bg={fallbackBg}
        flexShrink={0}
      >
        <Text fontSize="sm" fontWeight="600" color={fallbackColor} whiteSpace="nowrap">
          {name}
        </Text>
      </Flex>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external, dynamic per-domain source; next/image can't optimize a third-party logo CDN URL here.
    <img
      src={`https://img.logo.dev/${domain}?token=${token}&size=72&format=png`}
      alt={name}
      height={36}
      style={{ height: '36px', width: 'auto', flexShrink: 0, opacity: 0.75, filter: 'grayscale(1)' }}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

export function MarketplaceLogoSlider() {
  const sectionBg = useColorModeValue('white', 'navy.900');
  const label = useColorModeValue('gray.500', 'whiteAlpha.500');
  const edgeFade = useColorModeValue(
    'linear-gradient(90deg, white 0%, transparent 8%, transparent 92%, white 100%)',
    'linear-gradient(90deg, #111C44 0%, transparent 8%, transparent 92%, #111C44 100%)',
  );
  const dividerColor = useColorModeValue('gray.100', 'whiteAlpha.100');
  const prefersReducedMotion = usePrefersReducedMotion();

  // Duplicated once so the track can loop seamlessly at -50% instead of
  // snapping back to start; skipped entirely under reduced motion, where a
  // static wrapped row reads better than a slider that never moves.
  const track = prefersReducedMotion ? MARKETPLACES : [...MARKETPLACES, ...MARKETPLACES];

  return (
    <Box bg={sectionBg} py={{ base: '40px', md: '56px' }} borderTop="1px solid" borderBottom="1px solid" borderColor={dividerColor}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Reveal>
          <Text
            textAlign="center"
            fontSize="xs"
            fontWeight="700"
            color={label}
            letterSpacing="0.08em"
            textTransform="uppercase"
            mb="28px"
          >
            Pricing tracked live across {MARKETPLACES.length} marketplaces
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
            animation={prefersReducedMotion ? undefined : `${scroll} 28s linear infinite`}
            sx={prefersReducedMotion ? undefined : { '&:hover': { animationPlayState: 'paused' } }}
          >
            {track.map((m, i) => (
              <LogoTile key={`${m.domain}-${i}`} name={m.name} domain={m.domain} />
            ))}
          </Flex>
        </Box>
      </Container>
    </Box>
  );
}

export default MarketplaceLogoSlider;
