'use client';

import { Box, Container, Flex, Grid, GridItem, Heading, Icon, Text, useColorModeValue } from '@chakra-ui/react';
import {
  MdBarChart,
  MdOutlineVisibility,
  MdNotificationsActive,
  MdAttachMoney,
  MdGroup,
  MdOutlineShoppingCart,
} from 'react-icons/md';
import { Reveal } from 'components/reactbits/Reveal';
import { SpotlightCard } from 'components/reactbits/SpotlightCard';

// Every feature here maps to something actually shipped in the product
// (see lib/market-intel/*.ts) - not aspirational marketing copy for
// features that don't exist yet.
//
// `wide` marks the two differentiators - the market data nobody else gives a
// Pakistani seller, and the recommendation built on top of it. A flat 3x2 grid
// gave all six equal weight, which buried them next to "orders, products,
// customers". They get the double-width tiles and a tinted surface so the
// section has an actual reading order.
const FEATURES = [
  {
    icon: MdOutlineVisibility,
    title: 'Live competitor tracking',
    description:
      'Pricing and stock data scraped from 7 marketplaces, refreshed automatically - category-wide pricing bands, stock-outs, and demand signals.',
    wide: true,
  },
  {
    icon: MdBarChart,
    title: 'Peer benchmarking',
    description:
      'See where your pricing, order volume, and repeat-purchase rate sit against anonymized sellers in your own category.',
  },
  {
    icon: MdNotificationsActive,
    title: 'Watchlists & price alerts',
    description:
      'Track specific competitor products and get notified the moment their price or stock status changes.',
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
  {
    icon: MdAttachMoney,
    title: 'Pricing recommendations',
    description:
      'A rule-based recommendation that keeps you inside the competitive band without dropping below your own margin floor.',
    wide: true,
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
  const wideBg = useColorModeValue(
    'linear-gradient(135deg, #F7F5FF 0%, #FFFFFF 60%)',
    'linear-gradient(135deg, #1B2559 0%, #111C44 60%)',
  );
  const glow = useColorModeValue('rgba(67, 24, 255, 0.06)', 'rgba(122, 101, 255, 0.10)');

  return (
    <Box id="features" bg={sectionBg} py={{ base: '80px', md: '120px' }} position="relative" overflow="hidden">
      {/* Ambient glow so the section is not a flat white slab behind white
          cards - the previous version had no depth between card and page. */}
      <Box
        position="absolute"
        top="10%"
        left="-160px"
        w="420px"
        h="420px"
        borderRadius="full"
        bg={`radial-gradient(circle, ${glow} 0%, transparent 70%)`}
        pointerEvents="none"
      />
      <Box
        position="absolute"
        bottom="5%"
        right="-180px"
        w="460px"
        h="460px"
        borderRadius="full"
        bg={`radial-gradient(circle, ${glow} 0%, transparent 70%)`}
        pointerEvents="none"
      />

      <Container maxW="1200px" px={{ base: '20px', md: '30px' }} position="relative">
        <Reveal>
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
        </Reveal>

        {/* 4-column bento on desktop: the two `wide` tiles take half a row each
            and sit on opposite rows, so the grid reads as a composition rather
            than six identical boxes. Collapses to a plain 2-up on tablet and
            1-up on mobile, where spans would only make tiles inconsistent. */}
        <Grid
          templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }}
          gap={{ base: '20px', md: '24px' }}
          autoRows="1fr"
        >
          {FEATURES.map((feature, i) => (
            <GridItem key={feature.title} colSpan={{ base: 1, md: 1, lg: feature.wide ? 2 : 1 }}>
              <Reveal delay={i * 70} h="100%">
                <SpotlightCard
                  unstyled
                  h="100%"
                  display="flex"
                  flexDirection="column"
                  p={{ base: '28px', md: '32px' }}
                  borderRadius="20px"
                  border="1px solid"
                  borderColor={cardBorder}
                  bg={feature.wide ? wideBg : cardBg}
                  boxShadow={cardShadow}
                  transition="border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease"
                  _hover={{
                    borderColor: '#4318FF',
                    boxShadow: '0px 20px 40px rgba(67, 24, 255, 0.12)',
                    transform: 'translateY(-4px)',
                  }}
                >
                  <Flex direction="column" h="100%">
                    <Flex
                      w={feature.wide ? '60px' : '52px'}
                      h={feature.wide ? '60px' : '52px'}
                      borderRadius="16px"
                      bg="linear-gradient(135deg, #4318FF 0%, #7B61FF 100%)"
                      align="center"
                      justify="center"
                      mb="20px"
                      boxShadow="0px 8px 16px rgba(67, 24, 255, 0.25)"
                      flexShrink={0}
                    >
                      <Icon as={feature.icon} boxSize={feature.wide ? '30px' : '26px'} color="white" />
                    </Flex>
                    <Text
                      fontWeight="700"
                      fontSize={feature.wide ? { base: 'lg', md: 'xl' } : 'lg'}
                      color={heading}
                      mb="10px"
                      letterSpacing="-0.01em"
                    >
                      {feature.title}
                    </Text>
                    <Text color={body} fontSize={feature.wide ? 'md' : 'sm'} lineHeight="1.7" maxW="46ch">
                      {feature.description}
                    </Text>
                  </Flex>
                </SpotlightCard>
              </Reveal>
            </GridItem>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

export default FeaturesSection;
