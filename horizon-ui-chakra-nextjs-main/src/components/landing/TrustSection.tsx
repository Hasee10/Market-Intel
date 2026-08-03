'use client';

import { Box, Container, Flex, Heading, Icon, SimpleGrid, Text, useColorModeValue } from '@chakra-ui/react';
import { MdVisibilityOff, MdOutlineFilterAlt, MdLock } from 'react-icons/md';
import { CountUp } from 'components/reactbits/CountUp';
import { Reveal } from 'components/reactbits/Reveal';
import { SpotlightCard } from 'components/reactbits/SpotlightCard';

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
  const sectionBg = useColorModeValue('#F7F8FF', 'navy.800');
  const kicker = useColorModeValue('#4318FF', '#A594FF');
  const heading = useColorModeValue('#111C4E', 'white');
  const body = useColorModeValue('gray.600', 'secondaryGray.400');
  const cardBg = useColorModeValue('white', 'navy.900');
  const cardBorder = useColorModeValue('gray.100', 'whiteAlpha.100');
  const cardShadow = useColorModeValue('0px 8px 24px rgba(17, 28, 78, 0.06)', 'none');
  const cardShadowHover = useColorModeValue('0px 16px 32px rgba(17, 28, 78, 0.1)', 'none');
  const numberColor = useColorModeValue('gray.50', 'whiteAlpha.100');
  const iconBg = useColorModeValue('#F4F1FF', 'whiteAlpha.100');

  return (
    <Box id="trust" bg={sectionBg} py={{ base: '80px', md: '120px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Reveal>
          <Box textAlign="center" mb={{ base: '50px', md: '72px' }}>
            <Text
              fontSize="xs"
              fontWeight="700"
              color={kicker}
              letterSpacing="0.08em"
              textTransform="uppercase"
              mb="12px"
            >
              How it works
            </Text>
            <Heading as="h2" fontSize={{ base: '28px', md: '40px' }} color={heading} mb="16px" letterSpacing="-0.02em">
              Peer benchmarking, not surveillance
            </Heading>
            <Text color={body} fontSize="lg" maxW="620px" mx="auto">
              Nothing private about a competitor&apos;s business is ever shown - here&apos;s exactly
              how that works.
            </Text>
          </Box>
        </Reveal>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing="28px">
          {POINTS.map((point, i) => (
            <Reveal key={point.title} delay={i * 100}>
              <SpotlightCard
                unstyled
                bg={cardBg}
                borderRadius="20px"
                border="1px solid"
                borderColor={cardBorder}
                boxShadow={cardShadow}
                p="32px"
                transition="all 0.2s ease"
                _hover={{ boxShadow: cardShadowHover, transform: 'translateY(-4px)' }}
              >
                <Flex direction="column">
                  <Text
                    position="absolute"
                    top="20px"
                    right="24px"
                    fontSize="40px"
                    fontWeight="800"
                    color={numberColor}
                    lineHeight="1"
                    aria-hidden
                  >
                    <CountUp value={String(i + 1).padStart(2, '0')} />
                  </Text>
                  <Box
                    w="48px"
                    h="48px"
                    borderRadius="12px"
                    bg={iconBg}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    mb="20px"
                  >
                    <Icon as={point.icon} boxSize="24px" color="#4318FF" />
                  </Box>
                  <Text fontWeight="700" fontSize="lg" color={heading} mb="10px" letterSpacing="-0.01em">
                    {point.title}
                  </Text>
                  <Text color={body} fontSize="sm" lineHeight="1.6">
                    {point.description}
                  </Text>
                </Flex>
              </SpotlightCard>
            </Reveal>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}

export default TrustSection;
