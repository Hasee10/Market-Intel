'use client';

import { Box, Center, Flex, Heading, Text, useColorModeValue } from '@chakra-ui/react';
import NextLink from 'next/link';
import { ReactNode } from 'react';

import { RyvlMark } from 'components/icons/RyvlMark';

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

// Lightweight centered-card layout for the auth pages (sign in / sign up /
// password reset). Was a completely bare card with no branding and no way
// back to the marketing site - now has the same Ryvl mark used everywhere
// else (linking home) and a minimal footer, so these pages don't feel
// stranded from the rest of the platform.
export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  const bg = useColorModeValue('white', 'navy.800');
  const textColor = useColorModeValue('secondaryGray.900', 'white');

  return (
    <Flex minH="100vh" w="100%" direction="column" align="center" justify="center" bg={useColorModeValue('gray.50', 'navy.900')} py="40px">
      <Box maxW="440px" w="100%" px="24px">
        <Center mb="24px">
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
    </Flex>
  );
}

export default AuthCard;
