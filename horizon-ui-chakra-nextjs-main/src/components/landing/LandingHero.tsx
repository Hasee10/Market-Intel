'use client';

import { Badge, Box, Button, Container, Flex, Heading, Icon, Stack, Text } from '@chakra-ui/react';
import { MdNotificationsActive, MdVerified } from 'react-icons/md';
import NextLink from 'next/link';

import { PATH_AUTH } from '@/lib/paths';

// Organic blurred blob shapes behind the composition - the same energy as
// the isometric-illustration references (soft colored shapes framing the
// device/screen mockups), without literal stock-illustration people. Stays
// honest to what this product actually is (a real analytics dashboard) while
// borrowing the layered, colorful, dynamic composition style.
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

// The primary "screen" of the composition - a dashboard mockup, not a
// literal screenshot, so it reads as "this is what the product actually
// shows you" without needing a real design asset.
function DashboardMockup() {
  return (
    <Box
      w="100%"
      maxW="440px"
      bg="white"
      borderRadius="20px"
      boxShadow="0px 30px 60px rgba(17, 28, 78, 0.18)"
      border="1px solid"
      borderColor="gray.100"
      p="24px"
      transform="rotate(-2deg)"
      transition="transform 0.3s ease"
      _hover={{ transform: 'rotate(0deg)' }}
    >
      <Flex justify="space-between" align="center" mb="16px">
        <Text fontWeight="700" fontSize="sm" color="#111C4E">
          Your category vs. market
        </Text>
        <Badge colorScheme="green" borderRadius="6px">
          Live
        </Badge>
      </Flex>
      <Stack spacing="10px" mb="20px">
        {[
          { label: 'Your median price', value: 78 },
          { label: 'Category P25', value: 55 },
          { label: 'Category median', value: 70 },
          { label: 'Category P75', value: 88 },
        ].map((row) => (
          <Box key={row.label}>
            <Flex justify="space-between" mb="4px">
              <Text fontSize="xs" color="gray.500">
                {row.label}
              </Text>
            </Flex>
            <Box h="8px" bg="gray.100" borderRadius="full" overflow="hidden">
              <Box h="100%" w={`${row.value}%`} bg="#4318FF" borderRadius="full" />
            </Box>
          </Box>
        ))}
      </Stack>
      <Flex gap="10px">
        <Box flex="1" bg="#F4F7FE" borderRadius="12px" p="12px">
          <Text fontSize="xs" color="gray.500">
            Competitor stock-outs
          </Text>
          <Text fontWeight="700" color="#111C4E">
            3 tracked
          </Text>
        </Box>
        <Box flex="1" bg="#F4F7FE" borderRadius="12px" p="12px">
          <Text fontSize="xs" color="gray.500">
            Price alerts (7d)
          </Text>
          <Text fontWeight="700" color="#111C4E">
            5 changes
          </Text>
        </Box>
      </Flex>
    </Box>
  );
}

// A smaller "floating notification" card offset behind the main mockup -
// the equivalent of the secondary phone/tablet devices layered around the
// big screen in the reference compositions.
function FloatingAlertCard() {
  return (
    <Box
      position="absolute"
      bottom={{ base: '-24px', md: '-32px' }}
      left={{ base: '-8px', md: '-40px' }}
      w="220px"
      bg="white"
      borderRadius="16px"
      boxShadow="0px 20px 40px rgba(17, 28, 78, 0.16)"
      border="1px solid"
      borderColor="gray.100"
      p="16px"
      transform="rotate(4deg)"
      zIndex={2}
    >
      <Flex align="center" gap="10px" mb="6px">
        <Flex w="28px" h="28px" borderRadius="8px" bg="#FFF4E5" align="center" justify="center">
          <Icon as={MdNotificationsActive} boxSize="16px" color="#FFB547" />
        </Flex>
        <Text fontSize="xs" fontWeight="700" color="#111C4E">
          Price alert
        </Text>
      </Flex>
      <Text fontSize="xs" color="gray.600">
        Competitor dropped price 12% on a watched item
      </Text>
    </Box>
  );
}

// A small floating "verified/trusted" badge, echoing the small circular
// accent icons that float around the isometric reference illustrations.
function FloatingVerifiedBadge() {
  return (
    <Flex
      position="absolute"
      top={{ base: '-16px', md: '-24px' }}
      left={{ base: '30%', md: '20px' }}
      w="52px"
      h="52px"
      borderRadius="full"
      bg="white"
      boxShadow="0px 12px 24px rgba(17, 28, 78, 0.14)"
      align="center"
      justify="center"
      zIndex={2}
    >
      <Icon as={MdVerified} boxSize="26px" color="#05CD99" />
    </Flex>
  );
}

export function LandingHero() {
  return (
    <Box bg="linear-gradient(180deg, #F7F8FF 0%, #FFFFFF 100%)" pt={{ base: '60px', md: '90px' }} pb={{ base: '90px', md: '120px' }} overflow="hidden">
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Flex direction={{ base: 'column', lg: 'row' }} align="center" gap={{ base: '70px', lg: '60px' }}>
          <Box flex="1">
            <Badge
              borderRadius="full"
              px="14px"
              py="6px"
              mb="24px"
              fontSize="xs"
              fontWeight="700"
              letterSpacing="0.04em"
              bg="#F4F1FF"
              color="#4318FF"
              border="1px solid"
              borderColor="#E4DBFF"
              textTransform="uppercase"
            >
              For online sellers
            </Badge>
            <Heading as="h1" fontSize={{ base: '36px', md: '52px' }} lineHeight="1.1" color="#111C4E" mb="20px">
              See your market.
              <br />
              Not just your store.
            </Heading>
            <Text fontSize={{ base: 'md', md: 'lg' }} color="gray.600" mb="32px" maxW="480px">
              Ryvl tracks competitor pricing across 7 marketplaces, benchmarks you against
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
          <Flex flex="1" justify="center" position="relative" mt={{ base: '20px', lg: '0' }}>
            <DecorativeBlobs />
            <Box position="relative" zIndex={1} maxW="440px" w="100%">
              <FloatingVerifiedBadge />
              <DashboardMockup />
              <FloatingAlertCard />
            </Box>
          </Flex>
        </Flex>
      </Container>
    </Box>
  );
}

export default LandingHero;
