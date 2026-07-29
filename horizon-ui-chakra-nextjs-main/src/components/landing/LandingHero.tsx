'use client';

import { Badge, Box, Button, Container, Flex, Heading, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';

import { PATH_AUTH } from '@/lib/paths';

// The hero graphic is a plain Chakra mockup of the Market page, not a
// literal screenshot or stock illustration - deliberately abstract, in
// brand colors, so it reads as "this is what the product actually shows
// you" without needing a real design asset.
function DashboardMockup() {
  return (
    <Box
      w="100%"
      maxW="480px"
      bg="white"
      borderRadius="20px"
      boxShadow="0px 30px 60px rgba(17, 28, 78, 0.15)"
      border="1px solid"
      borderColor="gray.100"
      p="24px"
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

export function LandingHero() {
  return (
    <Box bg="linear-gradient(180deg, #F7F8FF 0%, #FFFFFF 100%)" pt={{ base: '60px', md: '90px' }} pb={{ base: '60px', md: '100px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Flex direction={{ base: 'column', lg: 'row' }} align="center" gap={{ base: '50px', lg: '60px' }}>
          <Box flex="1">
            <Badge colorScheme="purple" borderRadius="full" px="12px" py="4px" mb="20px" fontSize="xs">
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
              <Button as={NextLink} href="#features" variant="outline" size="lg" px="32px">
                See how it works
              </Button>
            </Stack>
          </Box>
          <Flex flex="1" justify="center">
            <DashboardMockup />
          </Flex>
        </Flex>
      </Container>
    </Box>
  );
}

export default LandingHero;
