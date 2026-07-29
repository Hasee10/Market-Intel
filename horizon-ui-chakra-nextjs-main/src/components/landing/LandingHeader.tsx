'use client';

import { Box, Button, Flex, Grid, HStack, Link as ChakraLink, Text } from '@chakra-ui/react';
import NextLink from 'next/link';

import { RyvlMark } from 'components/icons/RyvlMark';
import { PATH_AUTH } from '@/lib/paths';

// Anchors are prefixed with `/` so they still resolve correctly from pages
// other than the homepage (e.g. from /pricing, "#features" alone would try
// to scroll /pricing itself instead of navigating back to the homepage
// section). Pricing is a real separate route, not an anchor.
const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#trust' },
  { label: 'Pricing', href: '/pricing' },
];

export function LandingHeader() {
  return (
    <Box as="header" position="sticky" top="0" zIndex="20" bg="white" borderBottom="1px solid" borderColor="gray.100">
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
          <Text fontWeight="bold" fontSize="20px" color="#111C4E">
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
              color="gray.600"
              _hover={{ color: '#4318FF', textDecoration: 'none' }}
            >
              {link.label}
            </ChakraLink>
          ))}
        </HStack>

        <HStack spacing="12px" justifySelf="end">
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
