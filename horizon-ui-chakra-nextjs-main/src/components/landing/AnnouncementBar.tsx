'use client';

import { useState } from 'react';

import { Box, Container, Flex, Icon, Link as ChakraLink, Text } from '@chakra-ui/react';
import { MdClose } from 'react-icons/md';
import NextLink from 'next/link';

// Thin top banner above the header (Atlassian/Astra-style promo strip) -
// ties to the real referral mechanic (see lib/market-intel/referrals.ts),
// not a fabricated "we have X customers" claim.
export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <Box bg="linear-gradient(90deg, #4318FF 0%, #6A47FF 100%)" py="10px">
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Flex align="center" justify="center" gap="8px" position="relative">
          <Text fontSize="sm" color="white" textAlign="center">
            🚀 Invite 3 sellers and unlock the Paid plan free -{' '}
            <ChakraLink as={NextLink} href="/pricing" textDecoration="underline" fontWeight="600">
              see how it works
            </ChakraLink>
          </Text>
          <Icon
            as={MdClose}
            position="absolute"
            right="0"
            boxSize="18px"
            color="whiteAlpha.800"
            cursor="pointer"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          />
        </Flex>
      </Container>
    </Box>
  );
}

export default AnnouncementBar;
