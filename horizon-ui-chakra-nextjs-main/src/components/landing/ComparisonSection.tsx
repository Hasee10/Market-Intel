'use client';

import { Box, Container, Flex, Heading, Icon, SimpleGrid, Text } from '@chakra-ui/react';
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
  return (
    <Box bg="white" py={{ base: '70px', md: '100px' }}>
      <Container maxW="1000px" px={{ base: '20px', md: '30px' }}>
        <Box textAlign="center" mb={{ base: '40px', md: '56px' }}>
          <Heading as="h2" fontSize={{ base: '28px', md: '36px' }} color="#111C4E" mb="12px" letterSpacing="-0.02em">
            What most sellers do today, vs. Ryvl
          </Heading>
          <Text color="gray.600" fontSize="lg" maxW="560px" mx="auto">
            Not a competitor comparison - a comparison against how this actually gets done without a
            tool for it.
          </Text>
        </Box>

        <Box borderRadius="20px" border="1px solid" borderColor="gray.100" overflow="hidden">
          <SimpleGrid columns={3} bg="#F7F8FF" py="14px" px={{ base: '16px', md: '28px' }}>
            <Text fontSize="sm" fontWeight="700" color="gray.500">
              &nbsp;
            </Text>
            <Text fontSize="sm" fontWeight="700" color="gray.500">
              Without Ryvl
            </Text>
            <Text fontSize="sm" fontWeight="700" color="#4318FF">
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
              borderColor="gray.100"
              alignItems="center"
            >
              <Text fontSize="sm" fontWeight="600" color="#111C4E">
                {row.label}
              </Text>
              <Flex align="center" gap="8px">
                <Icon as={MdClose} color="red.400" boxSize="16px" flexShrink={0} />
                <Text fontSize="sm" color="gray.500">
                  {row.without}
                </Text>
              </Flex>
              <Flex align="center" gap="8px">
                <Icon as={MdCheck} color="green.400" boxSize="16px" flexShrink={0} />
                <Text fontSize="sm" color="#111C4E" fontWeight="500">
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
