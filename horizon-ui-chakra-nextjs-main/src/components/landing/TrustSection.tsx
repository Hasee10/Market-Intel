import { Box, Container, Flex, Heading, SimpleGrid, Text } from '@chakra-ui/react';

// Same wording as the "Peer benchmarking, not surveillance" alert on the
// actual Market page (dashboard/market/MarketView.tsx) - the landing page
// promise and the in-product behavior should say the same thing, not two
// different stories.
const POINTS = [
  {
    title: 'Aggregate or opt-in only',
    description:
      'You only ever see anonymized, aggregate benchmarks - or fields a peer has explicitly chosen to share, like rating or price position.',
  },
  {
    title: 'A sample-size floor',
    description:
      "Benchmarks don't compute at all until enough sellers share a category, so no single competitor's numbers can be reverse-engineered.",
  },
  {
    title: 'Your private data stays private',
    description:
      'Your own orders, customers, and churn numbers are never visible to another seller - full stop, no setting can change that.',
  },
];

export function TrustSection() {
  return (
    <Box id="trust" bg="#F7F8FF" py={{ base: '70px', md: '100px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Box textAlign="center" mb="50px">
          <Heading as="h2" fontSize={{ base: '28px', md: '36px' }} color="#111C4E" mb="12px">
            Peer benchmarking, not surveillance
          </Heading>
          <Text color="gray.600" fontSize="lg" maxW="620px" mx="auto">
            Nothing private about a competitor&apos;s business is ever shown - here&apos;s exactly
            how that works.
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing="32px">
          {POINTS.map((point) => (
            <Flex key={point.title} direction="column" bg="white" borderRadius="16px" p="28px">
              <Text fontWeight="700" fontSize="lg" color="#111C4E" mb="8px">
                {point.title}
              </Text>
              <Text color="gray.600" fontSize="sm">
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
