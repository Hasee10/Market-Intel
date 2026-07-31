'use client';

import { Box, Button, Container, Flex, Heading, Text, useColorModeValue } from '@chakra-ui/react';
import NextLink from 'next/link';

// Pricing now lives on its own page (/pricing) - this is just a short
// link-out from the homepage instead of duplicating the full tier
// breakdown in two places.
export function PricingTeaser() {
  const sectionBg = useColorModeValue('#F7F8FF', 'navy.800');
  const heading = useColorModeValue('#111C4E', 'white');
  const body = useColorModeValue('gray.600', 'secondaryGray.400');

  return (
    <Box id="pricing" bg={sectionBg} py={{ base: '50px', md: '70px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Flex direction={{ base: 'column', md: 'row' }} align="center" justify="space-between" gap="20px">
          <Box textAlign={{ base: 'center', md: 'left' }}>
            <Heading as="h2" fontSize={{ base: '24px', md: '28px' }} color={heading} mb="8px">
              Free to start. Grows with how deep you want to go.
            </Heading>
            <Text color={body}>Free, Paid, and Premium tiers - see exactly what&apos;s included in each.</Text>
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
