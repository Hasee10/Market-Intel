'use client';

import { Box, Container, Heading, Icon, SimpleGrid, Text } from '@chakra-ui/react';
import {
  MdBarChart,
  MdOutlineVisibility,
  MdNotificationsActive,
  MdAttachMoney,
  MdGroup,
  MdOutlineShoppingCart,
} from 'react-icons/md';

// Every feature here maps to something actually shipped in the product
// (see lib/market-intel/*.ts) - not aspirational marketing copy for
// features that don't exist yet.
const FEATURES = [
  {
    icon: MdBarChart,
    title: 'Peer benchmarking',
    description:
      'See where your pricing, order volume, and repeat-purchase rate sit against anonymized sellers in your own category.',
  },
  {
    icon: MdOutlineVisibility,
    title: 'Live competitor tracking',
    description:
      'Pricing and stock data scraped from 7 marketplaces, refreshed automatically - category-wide pricing bands, stock-outs, and demand signals.',
  },
  {
    icon: MdNotificationsActive,
    title: 'Watchlists & price alerts',
    description:
      'Track specific competitor products and get notified the moment their price or stock status changes.',
  },
  {
    icon: MdAttachMoney,
    title: 'Pricing recommendations',
    description:
      'A rule-based recommendation that keeps you inside the competitive band without dropping below your own margin floor.',
  },
  {
    icon: MdGroup,
    title: 'Churn & retention insights',
    description:
      'RFM-scored at-risk customer lists and retention/repeat-purchase metrics, computed from your own order history.',
  },
  {
    icon: MdOutlineShoppingCart,
    title: 'Orders, products, customers',
    description:
      'The operational basics in one place, with CSV bulk import so you are not retyping your existing catalog by hand.',
  },
];

export function FeaturesSection() {
  return (
    <Box id="features" py={{ base: '70px', md: '100px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Box textAlign="center" mb="60px">
          <Heading as="h2" fontSize={{ base: '28px', md: '36px' }} color="#111C4E" mb="12px">
            Everything you need to sell with your eyes open
          </Heading>
          <Text color="gray.600" fontSize="lg" maxW="560px" mx="auto">
            Your own store analytics, plus the market context that most sellers never get to see.
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing="32px">
          {FEATURES.map((feature) => (
            <Box key={feature.title} p="28px" borderRadius="16px" border="1px solid" borderColor="gray.100" bg="white">
              <Box
                w="48px"
                h="48px"
                borderRadius="12px"
                bg="#F4F1FF"
                display="flex"
                alignItems="center"
                justifyContent="center"
                mb="16px"
              >
                <Icon as={feature.icon} boxSize="24px" color="#4318FF" />
              </Box>
              <Text fontWeight="700" fontSize="lg" color="#111C4E" mb="8px">
                {feature.title}
              </Text>
              <Text color="gray.600" fontSize="sm">
                {feature.description}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}

export default FeaturesSection;
