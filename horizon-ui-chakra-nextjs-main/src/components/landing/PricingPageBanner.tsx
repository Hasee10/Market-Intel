'use client';

import { Box, Container, Heading, Text, useColorModeValue } from '@chakra-ui/react';

// The top banner/hero for the dedicated /pricing page - separate from the
// PricingTeaser strip on the homepage, which just links here.
export function PricingPageBanner() {
  const bannerBg = useColorModeValue(
    'linear-gradient(180deg, #F7F8FF 0%, #FFFFFF 100%)',
    'linear-gradient(180deg, #111C4E 0%, #0B1437 100%)',
  );
  const heading = useColorModeValue('#111C4E', 'white');
  const body = useColorModeValue('gray.600', 'secondaryGray.400');

  return (
    <Box bg={bannerBg} pt={{ base: '60px', md: '80px' }} pb={{ base: '40px', md: '50px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }} textAlign="center">
        <Heading as="h1" fontSize={{ base: '32px', md: '44px' }} color={heading} mb="16px">
          Simple, honest pricing
        </Heading>
        <Text fontSize={{ base: 'md', md: 'lg' }} color={body} maxW="560px" mx="auto">
          Start free on your own store. Unlock peer benchmarking, competitor tracking, and full
          market intelligence as you need them - or earn it free by growing the benchmark pool.
        </Text>
      </Container>
    </Box>
  );
}

export default PricingPageBanner;
