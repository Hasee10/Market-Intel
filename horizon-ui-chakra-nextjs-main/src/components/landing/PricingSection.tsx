'use client';

import { Badge, Box, Button, Container, Flex, Heading, Icon, SimpleGrid, Text, useColorModeValue } from '@chakra-ui/react';
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
    tagline: 'See what your competitors charge',
    features: [
      'Everything in Free',
      'Competitor product matching',
      'Pricing recommendations',
      'Watchlists & price alerts',
    ],
    cta: 'Start free',
    highlighted: true,
    note: 'Or unlock it free - refer 3 sellers',
  },
  {
    name: 'Premium',
    tagline: 'Forecasting and scale',
    features: [
      'Everything in Paid',
      'Price & demand forecasting',
      'Anomaly detection',
      'Multiple domains',
      // Deliberately last and hedged: domain_benchmarks needs 3+ opted-in
      // sellers in a category before it renders anything (benchmarks-job.ts),
      // so promising it flatly would be selling a screen that may be empty
      // on the day someone pays. Keep the wording conditional until the
      // network is dense enough for it to be a headline.
      'Peer benchmarking, as your category fills up',
    ],
    cta: 'Start free',
    highlighted: false,
  },
];

export function PricingSection() {
  const heading = useColorModeValue('#111C4E', 'white');
  const body = useColorModeValue('gray.600', 'secondaryGray.400');
  const cardBorder = useColorModeValue('gray.100', 'whiteAlpha.100');
  const cardShadow = useColorModeValue('0px 20px 40px rgba(67, 24, 255, 0.15)', '0px 0px 0px 1px #4318FF');
  const featureText = useColorModeValue('gray.700', 'secondaryGray.300');
  const noteText = useColorModeValue('gray.500', 'secondaryGray.500');

  return (
    <Box id="pricing" py={{ base: '70px', md: '100px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Box textAlign="center" mb="60px">
          <Heading as="h2" fontSize={{ base: '28px', md: '36px' }} color={heading} mb="12px">
            Grows with how deep you want to go
          </Heading>
          <Text color={body} fontSize="lg" maxW="560px" mx="auto">
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
              borderColor={tier.highlighted ? '#4318FF' : cardBorder}
              boxShadow={tier.highlighted ? cardShadow : 'none'}
              position="relative"
            >
              {tier.highlighted && (
                <Badge position="absolute" top="-12px" left="32px" colorScheme="purple" borderRadius="full" px="10px">
                  Most popular
                </Badge>
              )}
              <Text fontWeight="800" fontSize="xl" color={heading} mb="4px">
                {tier.name}
              </Text>
              <Text color={body} fontSize="sm" mb="24px">
                {tier.tagline}
              </Text>
              <Box mb="24px">
                {tier.features.map((feature) => (
                  <Flex key={feature} align="start" gap="8px" mb="10px">
                    <Icon as={MdCheck} color="#4318FF" boxSize="18px" mt="2px" />
                    <Text fontSize="sm" color={featureText}>
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
                <Text fontSize="xs" color={noteText} textAlign="center">
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
