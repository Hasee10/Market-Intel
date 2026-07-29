'use client';

import { Box, Container, Flex, Heading, SimpleGrid, Text } from '@chakra-ui/react';

// The actual seller journey through the product, not the privacy mechanics
// (that's TrustSection) - a concrete 3-step process bridges "what is this"
// (hero) to "what you get" (features).
const STEPS = [
  {
    step: '01',
    title: 'Pick your category',
    description:
      'One-time setup after signup - choose the category you sell in (mobiles, fashion, and more as coverage expands). This decides which scraped market data and anonymized peers you get benchmarked against.',
  },
  {
    step: '02',
    title: 'We track the market for you',
    description:
      "Competitor pricing and stock across 7 marketplaces refresh automatically, alongside your own store's orders, products, and customers - all in one dashboard.",
  },
  {
    step: '03',
    title: 'Act on real signals',
    description:
      'Price alerts when a watched competitor changes, pricing recommendations that respect your margin floor, and at-risk customer lists - not just charts to look at.',
  },
];

export function HowItWorksSection() {
  return (
    <Box id="how-it-works" bg="#F7F8FF" py={{ base: '70px', md: '100px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Box textAlign="center" mb={{ base: '50px', md: '72px' }}>
          <Text fontSize="xs" fontWeight="700" color="#4318FF" letterSpacing="0.08em" textTransform="uppercase" mb="12px">
            The process
          </Text>
          <Heading as="h2" fontSize={{ base: '28px', md: '40px' }} color="#111C4E" mb="16px" letterSpacing="-0.02em">
            From signup to your first insight
          </Heading>
          <Text color="gray.600" fontSize="lg" maxW="560px" mx="auto">
            No setup calls, no data imports required to start - just pick a category and the market
            context is already there.
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={{ base: '40px', md: '32px' }}>
          {STEPS.map((item) => (
            <Flex key={item.step} direction="column" position="relative">
              <Text fontSize="48px" fontWeight="800" color="#E4DBFF" lineHeight="1" mb="12px">
                {item.step}
              </Text>
              <Text fontWeight="700" fontSize="lg" color="#111C4E" mb="10px">
                {item.title}
              </Text>
              <Text color="gray.600" fontSize="sm" lineHeight="1.6">
                {item.description}
              </Text>
            </Flex>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}

export default HowItWorksSection;
