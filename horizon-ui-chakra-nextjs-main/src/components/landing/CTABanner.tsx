'use client';

import { Box, Button, Container, Flex, Heading, Text } from '@chakra-ui/react';
import NextLink from 'next/link';

import { PATH_AUTH } from '@/lib/paths';

export function CTABanner() {
  return (
    <Box bg="#111C4E" py={{ base: '60px', md: '80px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Flex direction={{ base: 'column', md: 'row' }} align="center" justify="space-between" gap="24px">
          <Box textAlign={{ base: 'center', md: 'left' }}>
            <Heading as="h2" fontSize={{ base: '26px', md: '32px' }} color="white" mb="8px">
              Ready to see where you stand?
            </Heading>
            <Text color="whiteAlpha.700">Set up your store in minutes. No credit card required.</Text>
          </Box>
          <Button as={NextLink} href={PATH_AUTH.signup} variant="brand" size="lg" px="32px" flexShrink={0}>
            Start free
          </Button>
        </Flex>
      </Container>
    </Box>
  );
}

export default CTABanner;
