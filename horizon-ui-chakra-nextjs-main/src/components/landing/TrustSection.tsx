'use client';

import { Box, Container, Flex, Heading, Icon, SimpleGrid, Text } from '@chakra-ui/react';
import { MdVisibilityOff, MdOutlineFilterAlt, MdLock } from 'react-icons/md';

// Same wording as the "Peer benchmarking, not surveillance" alert on the
// actual Market page (dashboard/market/MarketView.tsx) - the landing page
// promise and the in-product behavior should say the same thing, not two
// different stories.
const POINTS = [
  {
    icon: MdVisibilityOff,
    title: 'Aggregate or opt-in only',
    description:
      'You only ever see anonymized, aggregate benchmarks - or fields a peer has explicitly chosen to share, like rating or price position.',
  },
  {
    icon: MdOutlineFilterAlt,
    title: 'A sample-size floor',
    description:
      "Benchmarks don't compute at all until enough sellers share a category, so no single competitor's numbers can be reverse-engineered.",
  },
  {
    icon: MdLock,
    title: 'Your private data stays private',
    description:
      'Your own orders, customers, and churn numbers are never visible to another seller - full stop, no setting can change that.',
  },
];

export function TrustSection() {
  return (
    <Box id="trust" bg="#F7F8FF" py={{ base: '80px', md: '120px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Box textAlign="center" mb={{ base: '50px', md: '72px' }}>
          <Text
            fontSize="xs"
            fontWeight="700"
            color="#4318FF"
            letterSpacing="0.08em"
            textTransform="uppercase"
            mb="12px"
          >
            How it works
          </Text>
          <Heading as="h2" fontSize={{ base: '28px', md: '40px' }} color="#111C4E" mb="16px" letterSpacing="-0.02em">
            Peer benchmarking, not surveillance
          </Heading>
          <Text color="gray.600" fontSize="lg" maxW="620px" mx="auto">
            Nothing private about a competitor&apos;s business is ever shown - here&apos;s exactly
            how that works.
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing="28px">
          {POINTS.map((point, i) => (
            <Flex
              key={point.title}
              direction="column"
              bg="white"
              borderRadius="20px"
              border="1px solid"
              borderColor="gray.100"
              boxShadow="0px 8px 24px rgba(17, 28, 78, 0.06)"
              p="32px"
              position="relative"
              transition="all 0.2s ease"
              _hover={{ boxShadow: '0px 16px 32px rgba(17, 28, 78, 0.1)', transform: 'translateY(-4px)' }}
            >
              <Text
                position="absolute"
                top="20px"
                right="24px"
                fontSize="40px"
                fontWeight="800"
                color="gray.50"
                lineHeight="1"
                aria-hidden
              >
                {String(i + 1).padStart(2, '0')}
              </Text>
              <Box
                w="48px"
                h="48px"
                borderRadius="12px"
                bg="#F4F1FF"
                display="flex"
                alignItems="center"
                justifyContent="center"
                mb="20px"
              >
                <Icon as={point.icon} boxSize="24px" color="#4318FF" />
              </Box>
              <Text fontWeight="700" fontSize="lg" color="#111C4E" mb="10px" letterSpacing="-0.01em">
                {point.title}
              </Text>
              <Text color="gray.600" fontSize="sm" lineHeight="1.6">
                {point.description}
              </Text>
            </Flex>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}

export default TrustSection;
