'use client';

import { Box, Center, Flex, Heading, Text, useColorModeValue } from '@chakra-ui/react';
import Image from 'next/image';
import NextLink from 'next/link';
import { ReactNode } from 'react';

import { RyvlMark } from 'components/icons/RyvlMark';

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  illustrationSrc?: string;
  illustrationAlt?: string;
};

// Two-column layout on larger screens (illustration panel + centered form),
// collapsing to the original single centered-card layout on mobile and
// whenever no illustration is passed. Was a completely bare card with no
// branding and no way back to the marketing site - now has the same Ryvl
// mark used everywhere else (linking home) and a minimal footer.
export function AuthCard({ title, subtitle, children, illustrationSrc, illustrationAlt }: AuthCardProps) {
  const bg = useColorModeValue('white', 'navy.800');
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const pageBg = useColorModeValue('gray.50', 'navy.900');

  const formColumn = (
    <Box maxW="440px" w="100%" px="24px" mx="auto">
      <Center mb="24px" display={{ base: 'flex', lg: illustrationSrc ? 'none' : 'flex' }}>
        <Flex as={NextLink} href="/" align="center" gap="8px">
          <RyvlMark size={26} />
          <Text fontWeight="bold" fontSize="20px" color={textColor}>
            Ryvl
          </Text>
        </Flex>
      </Center>

      <Center mb="24px" flexDirection="column">
        <Heading size="lg" color={textColor} textAlign="center">
          {title}
        </Heading>
        {subtitle && (
          <Text color="secondaryGray.600" mt="8px" textAlign="center">
            {subtitle}
          </Text>
        )}
      </Center>
      <Box bg={bg} borderRadius="20px" boxShadow="0px 18px 40px rgba(112, 144, 176, 0.12)" p="32px">
        {children}
      </Box>

      <Center mt="32px">
        <Text
          as={NextLink}
          href="/"
          fontSize="sm"
          color="secondaryGray.600"
          _hover={{ color: 'brand.500', textDecoration: 'underline' }}
        >
          &larr; Back to home
        </Text>
      </Center>
    </Box>
  );

  if (!illustrationSrc) {
    return (
      <Flex minH="100vh" w="100%" direction="column" align="center" justify="center" bg={pageBg} py="40px">
        {formColumn}
      </Flex>
    );
  }

  return (
    <Flex minH="100vh" w="100%" bg={pageBg}>
      <Flex
        display={{ base: 'none', lg: 'flex' }}
        flex="1"
        direction="column"
        align="center"
        justify="center"
        bg="linear-gradient(160deg, #F4F1FF 0%, #EEF2FF 100%)"
        px="60px"
        position="relative"
        overflow="hidden"
      >
        <Box
          position="absolute"
          top="-60px"
          left="-40px"
          w="260px"
          h="260px"
          borderRadius="full"
          bg="radial-gradient(circle, rgba(67,24,255,0.14) 0%, rgba(67,24,255,0) 70%)"
        />
        <Flex as={NextLink} href="/" align="center" gap="8px" position="absolute" top="40px" left="60px">
          <RyvlMark size={26} />
          <Text fontWeight="bold" fontSize="20px" color={textColor}>
            Ryvl
          </Text>
        </Flex>
        {/* next/image rather than a raw <img>: these signin/signup PNGs are
            ~600KB each at source and this is the first screen an unsigned-in
            visitor sees. With image optimization now enabled (next.config.js)
            this serves a resized AVIF/WebP instead. priority because it's
            above the fold - lazy-loading the hero art just moves the blank
            frame later. */}
        <Image
          src={illustrationSrc}
          alt={illustrationAlt ?? ''}
          width={1200}
          height={800}
          priority
          sizes="(max-width: 992px) 0px, 480px"
          style={{ width: '100%', maxWidth: '480px', height: 'auto', position: 'relative' }}
        />
      </Flex>

      <Flex flex="1" direction="column" align="center" justify="center" py="40px">
        {formColumn}
      </Flex>
    </Flex>
  );
}

export default AuthCard;
