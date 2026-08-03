'use client';

import { Box, Button, Container, Flex, Heading, Icon, Text } from '@chakra-ui/react';
import { MdArrowForward } from 'react-icons/md';
import NextLink from 'next/link';

import { PATH_AUTH } from '@/lib/paths';

export function CTABanner() {
  return (
    <Box py={{ base: '50px', md: '70px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Box
          position="relative"
          overflow="hidden"
          borderRadius="28px"
          bg="linear-gradient(135deg, #4318FF 0%, #7B61FF 100%)"
          px={{ base: '28px', md: '64px' }}
          py={{ base: '48px', md: '64px' }}
        >
          {/* Decorative dot grid + glow so this reads as a designed card,
              not a flat dead block of color. */}
          <Box
            position="absolute"
            inset="0"
            opacity="0.5"
            backgroundImage="radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)"
            backgroundSize="18px 18px"
            sx={{ maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0))' }}
          />
          <Box
            position="absolute"
            top="-100px"
            right="-80px"
            w="280px"
            h="280px"
            borderRadius="full"
            bg="radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%)"
          />

          <Flex
            direction={{ base: 'column', md: 'row' }}
            align="center"
            justify="space-between"
            gap="28px"
            position="relative"
          >
            <Box textAlign={{ base: 'center', md: 'left' }}>
              <Heading as="h2" fontSize={{ base: '28px', md: '36px' }} color="white" mb="10px">
                Ready to see where you stand?
              </Heading>
              <Text color="whiteAlpha.700" fontSize={{ base: 'sm', md: 'md' }}>
                Free on your own store data. No credit card, no sales call.
              </Text>
            </Box>
            <Button
              as={NextLink}
              href={PATH_AUTH.signup}
              bg="white"
              color="#111C4E"
              _hover={{ bg: 'whiteAlpha.900', transform: 'translateY(-1px)' }}
              size="lg"
              px="32px"
              flexShrink={0}
              rightIcon={<Icon as={MdArrowForward} />}
            >
              Start free
            </Button>
          </Flex>
        </Box>
      </Container>
    </Box>
  );
}

export default CTABanner;
