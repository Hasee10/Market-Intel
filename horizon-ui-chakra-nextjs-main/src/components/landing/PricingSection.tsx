'use client';

import { Badge, Box, Button, Container, Flex, Heading, Icon, SimpleGrid, Text } from '@chakra-ui/react';
import { MdCheck } from 'react-icons/md';
import NextLink from 'next/link';

import { PATH_AUTH } from '@/lib/paths';

// Mirrors the actual tier boundaries in lib/market-intel/entitlements.ts -
// this is the real gating logic in the app, not aspirational marketing
// tiers invented for the landing page. No dollar figures: there's no
// billing provider wired up yet (see entitlements.ts), so a fabricated
// price would just be a lie the moment someone tries to check out.
const TIERS = [
  {
    name: 'Free',
    tagline: 'Your own store, fully analyzed',
    features: ['Overview, products, customers, orders', 'Churn & retention insights', 'Bulk CSV import'],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Paid',
    tagline: 'See the market',
    features: ['Everything in Free', 'Peer benchmarking', 'Watchlists & price alerts'],
    cta: 'Start free',
    highlighted: true,
    note: 'Or unlock it free - refer 3 sellers',
  },
  {
    name: 'Premium',
    tagline: 'Full market intelligence',
    features: [
      'Everything in Paid',
      'Competitor product matching',
      'Pricing recommendations & forecasting',
      'Anomaly detection, multi-domain',
    ],
    cta: 'Start free',
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <Box id="pricing" py={{ base: '70px', md: '100px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Box textAlign="center" mb="60px">
          <Heading as="h2" fontSize={{ base: '28px', md: '36px' }} color="#111C4E" mb="12px">
            Grows with how deep you want to go
          </Heading>
          <Text color="gray.600" fontSize="lg" maxW="560px" mx="auto">
            Start free on your own store. Unlock market intelligence as you need it.
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing="32px">
          {TIERS.map((tier) => (
            <Box
              key={tier.name}
              borderRadius="20px"
              p="32px"
              border="1px solid"
              borderColor={tier.highlighted ? '#4318FF' : 'gray.100'}
              boxShadow={tier.highlighted ? '0px 20px 40px rgba(67, 24, 255, 0.15)' : 'none'}
              position="relative"
            >
              {tier.highlighted && (
                <Badge position="absolute" top="-12px" left="32px" colorScheme="purple" borderRadius="full" px="10px">
                  Most popular
                </Badge>
              )}
              <Text fontWeight="800" fontSize="xl" color="#111C4E" mb="4px">
                {tier.name}
              </Text>
              <Text color="gray.600" fontSize="sm" mb="24px">
                {tier.tagline}
              </Text>
              <Box mb="24px">
                {tier.features.map((feature) => (
                  <Flex key={feature} align="start" gap="8px" mb="10px">
                    <Icon as={MdCheck} color="#4318FF" boxSize="18px" mt="2px" />
                    <Text fontSize="sm" color="gray.700">
                      {feature}
                    </Text>
                  </Flex>
                ))}
              </Box>
              <Button
                as={NextLink}
                href={PATH_AUTH.signup}
                variant={tier.highlighted ? 'brand' : 'outline'}
                w="100%"
                mb={tier.note ? '10px' : '0'}
              >
                {tier.cta}
              </Button>
              {tier.note && (
                <Text fontSize="xs" color="gray.500" textAlign="center">
                  {tier.note}
                </Text>
              )}
            </Box>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}

export default PricingSection;
