'use client';

import { Box, Button, Flex, Grid, HStack, Link as ChakraLink, Text, useColorModeValue } from '@chakra-ui/react';
import NextLink from 'next/link';

import { RyvlMark } from 'components/icons/RyvlMark';
import { ThemeToggleMenu } from '@/components/navbar/ThemeToggleMenu';
import { PATH_AUTH } from '@/lib/paths';

// "#features" is prefixed with `/` so it still resolves correctly from pages
// other than the homepage. How it works, trust, and pricing are all real
// separate routes now, not anchors.
const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Trust', href: '/trust' },
  { label: 'Pricing', href: '/pricing' },
];

export function LandingHeader() {
  const bg = useColorModeValue('white', 'navy.900');
  const borderColor = useColorModeValue('gray.100', 'whiteAlpha.100');
  const logoColor = useColorModeValue('#111C4E', 'white');
  const linkColor = useColorModeValue('gray.600', 'secondaryGray.400');

  return (
    <Box as="header" position="sticky" top="0" zIndex="20" bg={bg} borderBottom="1px solid" borderColor={borderColor}>
      {/* 3-column grid (not a space-between Flex) so the nav links center
          on the header's true midpoint, independent of how wide the logo
          or the button group happen to be - space-between only centers
          content when the two outer items are equal width, which they
          weren't here. */}
      <Grid
        templateColumns={{ base: '1fr auto', md: '1fr auto 1fr' }}
        maxW="1200px"
        mx="auto"
        px={{ base: '20px', md: '30px' }}
        h="72px"
        alignItems="center"
      >
        <Flex as={NextLink} href="/" align="center" gap="8px" justifySelf="start">
          <RyvlMark size={26} />
          <Text fontWeight="bold" fontSize="20px" color={logoColor}>
            Ryvl
          </Text>
        </Flex>

        <HStack spacing="32px" display={{ base: 'none', md: 'flex' }} justifySelf="center">
          {NAV_LINKS.map((link) => (
            <ChakraLink
              key={link.href}
              href={link.href}
              fontSize="sm"
              fontWeight="500"
              color={linkColor}
              _hover={{ color: '#4318FF', textDecoration: 'none' }}
            >
              {link.label}
            </ChakraLink>
          ))}
        </HStack>

        <HStack spacing="16px" justifySelf="end">
          <ThemeToggleMenu />
          <Button as={NextLink} href={PATH_AUTH.signin} variant="ghost" size="sm" display={{ base: 'none', sm: 'inline-flex' }}>
            Sign in
          </Button>
          <Button as={NextLink} href={PATH_AUTH.signup} variant="brand" size="sm">
            Get started free
          </Button>
        </HStack>
      </Grid>
    </Box>
  );
}

export default LandingHeader;
