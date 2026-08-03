'use client';

import { Flex, Text, useColorModeValue } from '@chakra-ui/react';
import { useState } from 'react';

// Shared by MarketplaceLogoSlider and CompanyLogoSlider. Renders a real
// logo.dev logo when a domain is given, and falls back to a styled text pill
// when it isn't (no domain on file) or the image fails to load (dead
// domain, no logo.dev coverage, token missing) - so one bad entry never
// blanks out a slot in either slider.
//
// `domain` is intentionally optional: CompanyLogoSlider uses this same tile
// for scraped brand names (Samsung, Nike, ...) that we have no logo rights
// or relationship for, and always renders those as text-only pills by simply
// not passing a domain - see showcase.ts for why that split exists.
export function LogoTile({ name, domain }: { name: string; domain?: string }) {
  const [failed, setFailed] = useState(false);
  const fallbackBg = useColorModeValue('gray.100', 'whiteAlpha.100');
  const fallbackColor = useColorModeValue('gray.500', 'whiteAlpha.600');
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

  if (!domain || failed || !token) {
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
      style={{ height: '36px', width: 'auto', flexShrink: 0 }}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

export default LogoTile;
