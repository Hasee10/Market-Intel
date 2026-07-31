'use client';

import { Box, Container, Flex, Heading, Icon, SimpleGrid, Text, useColorModeValue } from '@chakra-ui/react';
import { MdClose, MdCheck } from 'react-icons/md';

// Compares against the real alternative most sellers actually have today
// (checking competitor sites by hand, spreadsheets) - not a fabricated
// vs.-named-competitor table with claims that can't be backed up.
const ROWS = [
  { label: 'Checking competitor prices', without: 'Manually, site by site', with: 'Tracked automatically across 7 marketplaces' },
  { label: 'Knowing your price position', without: 'Guesswork', with: 'Benchmarked against your category, live' },
  { label: 'Catching a competitor price drop', without: 'Only if you happen to check', with: 'Alerted the moment it changes' },
  { label: 'Setting your own prices', without: 'Gut feeling', with: 'A margin-safe recommendation' },
  { label: 'Spotting at-risk customers', without: "Usually you don't, until they've churned", with: 'Flagged before they go quiet' },
];

export function ComparisonSection() {
  const sectionBg = useColorModeValue('white', 'navy.900');
  const heading = useColorModeValue('#111C4E', 'white');
  const body = useColorModeValue('gray.600', 'secondaryGray.400');
  const tableBorder = useColorModeValue('gray.100', 'whiteAlpha.100');
  const tableHeaderBg = useColorModeValue('#F7F8FF', 'navy.800');
  const mutedLabel = useColorModeValue('gray.500', 'secondaryGray.500');
  const accent = useColorModeValue('#4318FF', '#A594FF');

  return (
    <Box bg={sectionBg} py={{ base: '70px', md: '100px' }}>
      <Container maxW="1000px" px={{ base: '20px', md: '30px' }}>
        <Box textAlign="center" mb={{ base: '40px', md: '56px' }}>
          <Heading as="h2" fontSize={{ base: '28px', md: '36px' }} color={heading} mb="12px" letterSpacing="-0.02em">
            What most sellers do today, vs. Ryvl
          </Heading>
          <Text color={body} fontSize="lg" maxW="560px" mx="auto">
            Not a competitor comparison - a comparison against how this actually gets done without a
            tool for it.
          </Text>
        </Box>

        <Box borderRadius="20px" border="1px solid" borderColor={tableBorder} overflow="hidden">
          <SimpleGrid columns={3} bg={tableHeaderBg} py="14px" px={{ base: '16px', md: '28px' }}>
            <Text fontSize="sm" fontWeight="700" color={mutedLabel}>
              &nbsp;
            </Text>
            <Text fontSize="sm" fontWeight="700" color={mutedLabel}>
              Without Ryvl
            </Text>
            <Text fontSize="sm" fontWeight="700" color={accent}>
              With Ryvl
            </Text>
          </SimpleGrid>
          {ROWS.map((row, i) => (
            <SimpleGrid
              key={row.label}
              columns={3}
              py="18px"
              px={{ base: '16px', md: '28px' }}
              borderTop={i > 0 ? '1px solid' : 'none'}
              borderColor={tableBorder}
              alignItems="center"
            >
              <Text fontSize="sm" fontWeight="600" color={heading}>
                {row.label}
              </Text>
              <Flex align="center" gap="8px">
                <Icon as={MdClose} color="red.400" boxSize="16px" flexShrink={0} />
                <Text fontSize="sm" color={mutedLabel}>
                  {row.without}
                </Text>
              </Flex>
              <Flex align="center" gap="8px">
                <Icon as={MdCheck} color="green.400" boxSize="16px" flexShrink={0} />
                <Text fontSize="sm" color={heading} fontWeight="500">
                  {row.with}
                </Text>
              </Flex>
            </SimpleGrid>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

export default ComparisonSection;
