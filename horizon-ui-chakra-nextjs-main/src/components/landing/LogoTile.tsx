'use client';

import { Flex, Text, useColorModeValue } from '@chakra-ui/react';
import { useState } from 'react';

// Shared by MarketplaceLogoSlider and CompanyLogoSlider. Every tile always
// shows the name; the logo mark above it is a real logo.dev image when a
// domain is given and loads successfully, or an initials avatar when it
// isn't (no domain on file, no logo.dev coverage, dead domain, token
// missing) - so one bad entry degrades to a placeholder mark instead of
// blanking out a slot in either slider.
export function LogoTile({ name, domain }: { name: string; domain?: string }) {
  const [failed, setFailed] = useState(false);
  const nameColor = useColorModeValue('gray.700', 'whiteAlpha.800');
  const initialsBg = useColorModeValue('gray.100', 'whiteAlpha.100');
  const initialsColor = useColorModeValue('gray.500', 'whiteAlpha.600');
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  const showLogo = !!domain && !failed && !!token;

  return (
    <Flex direction="column" align="center" gap="8px" w="88px" flexShrink={0}>
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- external, dynamic per-domain source; next/image can't optimize a third-party logo CDN URL here.
        <img
          src={`https://img.logo.dev/${domain}?token=${token}&size=72&format=png`}
          alt={name}
          width={40}
          height={40}
          style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px' }}
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <Flex align="center" justify="center" w="40px" h="40px" borderRadius="8px" bg={initialsBg}>
          <Text fontSize="sm" fontWeight="700" color={initialsColor}>
            {name.trim().charAt(0).toUpperCase() || '?'}
          </Text>
        </Flex>
      )}
      <Text fontSize="xs" fontWeight="600" color={nameColor} whiteSpace="nowrap" noOfLines={1}>
        {name}
      </Text>
    </Flex>
  );
}

export default LogoTile;
