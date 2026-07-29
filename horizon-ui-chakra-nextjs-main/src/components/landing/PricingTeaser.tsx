'use client';

import { Box, Button, Container, Flex, Heading, Text } from '@chakra-ui/react';
import NextLink from 'next/link';

// Pricing now lives on its own page (/pricing) - this is just a short
// link-out from the homepage instead of duplicating the full tier
// breakdown in two places.
export function PricingTeaser() {
  return (
    <Box id="pricing" bg="#F7F8FF" py={{ base: '50px', md: '70px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Flex direction={{ base: 'column', md: 'row' }} align="center" justify="space-between" gap="20px">
          <Box textAlign={{ base: 'center', md: 'left' }}>
            <Heading as="h2" fontSize={{ base: '24px', md: '28px' }} color="#111C4E" mb="8px">
              Free to start. Grows with how deep you want to go.
            </Heading>
            <Text color="gray.600">Free, Paid, and Premium tiers - see exactly what's included in each.</Text>
          </Box>
          <Button as={NextLink} href="/pricing" variant="brand" size="lg" px="32px" flexShrink={0}>
            See full pricing
          </Button>
        </Flex>
      </Container>
    </Box>
  );
}

export default PricingTeaser;
