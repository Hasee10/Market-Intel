'use client';

import { Box, Button, Flex, HStack, Link as ChakraLink, Text } from '@chakra-ui/react';
import NextLink from 'next/link';

import { RyvlMark } from 'components/icons/RyvlMark';
import { PATH_AUTH } from '@/lib/paths';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#trust' },
  { label: 'Pricing', href: '#pricing' },
];

export function LandingHeader() {
  return (
    <Box as="header" position="sticky" top="0" zIndex="20" bg="white" borderBottom="1px solid" borderColor="gray.100">
      <Flex maxW="1200px" mx="auto" px={{ base: '20px', md: '30px' }} h="72px" align="center" justify="space-between">
        <Flex as={NextLink} href="/" align="center" gap="8px">
          <RyvlMark size={26} />
          <Text fontWeight="bold" fontSize="20px" color="#111C4E">
            Ryvl
          </Text>
        </Flex>

        <HStack spacing="32px" display={{ base: 'none', md: 'flex' }}>
          {NAV_LINKS.map((link) => (
            <ChakraLink
              key={link.href}
              href={link.href}
              fontSize="sm"
              fontWeight="500"
              color="gray.600"
              _hover={{ color: '#4318FF', textDecoration: 'none' }}
            >
              {link.label}
            </ChakraLink>
          ))}
        </HStack>

        <HStack spacing="12px">
          <Button as={NextLink} href={PATH_AUTH.signin} variant="ghost" size="sm" display={{ base: 'none', sm: 'inline-flex' }}>
            Sign in
          </Button>
          <Button as={NextLink} href={PATH_AUTH.signup} variant="brand" size="sm">
            Get started free
          </Button>
        </HStack>
      </Flex>
    </Box>
  );
}

export default LandingHeader;
