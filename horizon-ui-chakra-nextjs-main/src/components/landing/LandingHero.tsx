'use client';

import { Badge, Box, Button, Container, Flex, Heading, Stack, Text, useColorModeValue } from '@chakra-ui/react';
import NextLink from 'next/link';

import { PATH_AUTH } from '@/lib/paths';

// Organic blurred blob shapes behind the illustration - the illustration
// itself has a transparent canvas (see public/assets/README via
// ryvl-hero-assets), so these show through and give the composition depth
// instead of the artwork floating on flat white.
function DecorativeBlobs() {
  return (
    <>
      <Box
        position="absolute"
        top="-60px"
        right="-40px"
        w="360px"
        h="360px"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(67,24,255,0.16) 0%, rgba(67,24,255,0) 70%)"
        filter="blur(2px)"
        zIndex={0}
      />
      <Box
        position="absolute"
        bottom="-40px"
        left="-30px"
        w="220px"
        h="220px"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(5,205,153,0.16) 0%, rgba(5,205,153,0) 70%)"
        zIndex={0}
      />
      <Box
        position="absolute"
        top="30%"
        right="-10px"
        w="140px"
        h="140px"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(255,181,71,0.18) 0%, rgba(255,181,71,0) 70%)"
        zIndex={0}
      />
    </>
  );
}

export function LandingHero() {
  const heroBg = useColorModeValue(
    'linear-gradient(180deg, #F7F8FF 0%, #FFFFFF 100%)',
    'linear-gradient(180deg, #111C4E 0%, #0B1437 100%)',
  );
  const badgeBg = useColorModeValue('#F4F1FF', 'whiteAlpha.100');
  const badgeBorder = useColorModeValue('#E4DBFF', 'whiteAlpha.200');
  const badgeColor = useColorModeValue('#4318FF', '#A594FF');
  const headingColor = useColorModeValue('#111C4E', 'white');
  const bodyColor = useColorModeValue('gray.600', 'secondaryGray.400');

  return (
    <Box bg={heroBg} pt={{ base: '60px', md: '90px' }} pb={{ base: '80px', md: '110px' }} overflow="hidden">
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Flex direction={{ base: 'column', lg: 'row' }} align="center" gap={{ base: '50px', lg: '60px' }}>
          <Box flex="1">
            <Badge
              borderRadius="full"
              px="14px"
              py="6px"
              mb="24px"
              fontSize="xs"
              fontWeight="700"
              letterSpacing="0.04em"
              bg={badgeBg}
              color={badgeColor}
              border="1px solid"
              borderColor={badgeBorder}
              textTransform="uppercase"
            >
              For online sellers
            </Badge>
            <Heading as="h1" fontSize={{ base: '36px', md: '52px' }} lineHeight="1.1" color={headingColor} mb="20px">
              See your market.
              <br />
              Not just your store.
            </Heading>
            <Text fontSize={{ base: 'md', md: 'lg' }} color={bodyColor} mb="32px" maxW="480px">
              Ryvl tracks competitor pricing across 11 marketplaces, benchmarks you against
              anonymized peers in your category, and tells you when to act — pricing
              recommendations, stock-out signals, and price alerts included.
            </Text>
            <Stack direction={{ base: 'column', sm: 'row' }} spacing="16px">
              <Button as={NextLink} href={PATH_AUTH.signup} variant="brand" size="lg" px="32px">
                Start free
              </Button>
              <Button as={NextLink} href="/#features" variant="outline" size="lg" px="32px">
                See how it works
              </Button>
            </Stack>
          </Box>
          <Flex flex="1" justify="center" position="relative" mt={{ base: '10px', lg: '0' }}>
            <DecorativeBlobs />
            <Box position="relative" zIndex={1} maxW="560px" w="100%">
              {/* Plain <img>, not next/image - it refuses local SVGs unless
                  images.dangerouslyAllowSVG is set in next.config.js, which
                  isn't worth adding config surface for one trusted local
                  asset that doesn't need srcset/lazy-loading anyway. */}
              <img
                src="/assets/ryvl-hero-illustration-vector.svg"
                alt="Seller comparing their store's pricing against market benchmarks on Ryvl"
                width={1500}
                height={1000}
                style={{ width: '100%', height: 'auto' }}
              />
            </Box>
          </Flex>
        </Flex>
      </Container>
    </Box>
  );
}

export default LandingHero;
