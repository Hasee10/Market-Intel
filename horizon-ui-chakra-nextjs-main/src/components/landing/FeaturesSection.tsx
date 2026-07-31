'use client';

import { Box, Container, Heading, Icon, SimpleGrid, Text, useColorModeValue } from '@chakra-ui/react';
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
  const sectionBg = useColorModeValue('white', 'navy.900');
  const kicker = useColorModeValue('#4318FF', '#A594FF');
  const heading = useColorModeValue('#111C4E', 'white');
  const body = useColorModeValue('gray.600', 'secondaryGray.400');
  const cardBg = useColorModeValue('white', 'navy.800');
  const cardBorder = useColorModeValue('gray.100', 'whiteAlpha.100');
  const cardShadow = useColorModeValue('0px 4px 16px rgba(17, 28, 78, 0.04)', 'none');

  return (
    <Box id="features" bg={sectionBg} py={{ base: '80px', md: '120px' }} position="relative">
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }} position="relative">
        <Box textAlign="center" mb={{ base: '50px', md: '72px' }}>
          <Text
            fontSize="xs"
            fontWeight="700"
            color={kicker}
            letterSpacing="0.08em"
            textTransform="uppercase"
            mb="12px"
          >
            What you get
          </Text>
          <Heading as="h2" fontSize={{ base: '28px', md: '40px' }} color={heading} mb="16px" letterSpacing="-0.02em">
            Everything you need to sell with your eyes open
          </Heading>
          <Text color={body} fontSize="lg" maxW="560px" mx="auto">
            Your own store analytics, plus the market context that most sellers never get to see.
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing="28px">
          {FEATURES.map((feature) => (
            <Box
              key={feature.title}
              position="relative"
              p="32px"
              borderRadius="20px"
              border="1px solid"
              borderColor={cardBorder}
              bg={cardBg}
              boxShadow={cardShadow}
              transition="all 0.2s ease"
              _hover={{
                borderColor: '#4318FF',
                boxShadow: '0px 20px 40px rgba(67, 24, 255, 0.12)',
                transform: 'translateY(-4px)',
              }}
            >
              <Box
                w="52px"
                h="52px"
                borderRadius="14px"
                bg="linear-gradient(135deg, #4318FF 0%, #7B61FF 100%)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                mb="20px"
                boxShadow="0px 8px 16px rgba(67, 24, 255, 0.25)"
              >
                <Icon as={feature.icon} boxSize="26px" color="white" />
              </Box>
              <Text fontWeight="700" fontSize="lg" color={heading} mb="10px" letterSpacing="-0.01em">
                {feature.title}
              </Text>
              <Text color={body} fontSize="sm" lineHeight="1.6">
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
