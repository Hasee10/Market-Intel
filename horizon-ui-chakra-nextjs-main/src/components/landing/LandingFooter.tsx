'use client';

import { Box, Container, Flex, Link as ChakraLink, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';

import { RyvlMark } from 'components/icons/RyvlMark';
import { PATH_AUTH } from '@/lib/paths';

// Only links to pages that actually exist - no placeholder About/Careers/
// Privacy/Terms links to nowhere. Add those columns back once those pages
// are real. "#features" is `/`-prefixed (see LandingHeader's note) so it
// still resolves when this footer renders on /pricing, not just the homepage.
const PRODUCT_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Trust', href: '/trust' },
];

const ACCOUNT_LINKS = [
  { label: 'Sign in', href: PATH_AUTH.signin },
  { label: 'Get started', href: PATH_AUTH.signup },
];

export function LandingFooter() {
  return (
    <Box as="footer" bg="#0B1230" pt="60px" pb="30px" position="relative" overflow="hidden">
      {/* Same quiet ambient glow the other dark surfaces (StatsBar, CTABanner)
          use, so the footer doesn't read as a plain flat bar by comparison. */}
      <Box
        position="absolute"
        top="-120px"
        left="50%"
        transform="translateX(-50%)"
        w="500px"
        h="240px"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(122,101,255,0.12) 0%, rgba(122,101,255,0) 70%)"
        pointerEvents="none"
      />
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }} position="relative">
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing="40px" mb="40px">
          <Box>
            <Flex align="center" gap="8px" mb="12px">
              <RyvlMark size={24} color="#8C7BFF" />
              <Text fontWeight="bold" fontSize="lg" color="white">
                Ryvl
              </Text>
            </Flex>
            <Text fontSize="sm" color="whiteAlpha.600" maxW="280px">
              Competitive market intelligence for online sellers - pricing benchmarks, competitor
              tracking, and alerts in one dashboard.
            </Text>
          </Box>

          <Box>
            <Text fontWeight="700" fontSize="sm" color="whiteAlpha.500" mb="16px" textTransform="uppercase" letterSpacing="wide">
              Product
            </Text>
            <Stack spacing="10px">
              {PRODUCT_LINKS.map((link) => (
                <ChakraLink key={link.href} as={NextLink} href={link.href} fontSize="sm" color="whiteAlpha.700" _hover={{ color: 'white' }}>
                  {link.label}
                </ChakraLink>
              ))}
            </Stack>
          </Box>

          <Box>
            <Text fontWeight="700" fontSize="sm" color="whiteAlpha.500" mb="16px" textTransform="uppercase" letterSpacing="wide">
              Account
            </Text>
            <Stack spacing="10px">
              {ACCOUNT_LINKS.map((link) => (
                <ChakraLink key={link.href} as={NextLink} href={link.href} fontSize="sm" color="whiteAlpha.700" _hover={{ color: 'white' }}>
                  {link.label}
                </ChakraLink>
              ))}
            </Stack>
          </Box>
        </SimpleGrid>

        <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt="24px">
          <Text fontSize="xs" color="whiteAlpha.500">
            &copy; {new Date().getFullYear()} Ryvl. All rights reserved.
          </Text>
        </Box>
      </Container>
    </Box>
  );
}

export default LandingFooter;
