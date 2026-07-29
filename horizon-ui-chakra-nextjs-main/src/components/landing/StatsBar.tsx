import { Box, Container, SimpleGrid, Text } from '@chakra-ui/react';

// Real, product-descriptive numbers (scraper coverage, refresh cadence) -
// deliberately not fake customer/user counts, since this product has no
// public user base to cite yet. Overstating traction here would be the
// kind of thing that erodes trust the moment someone checks.
const STATS = [
  { value: '7', label: 'Marketplaces tracked live' },
  { value: '12', label: 'Seller categories supported' },
  { value: '48hrs', label: 'Max data refresh cycle' },
  { value: '0', label: 'Raw competitor data ever shown to you' },
];

export function StatsBar() {
  return (
    <Box bg="#111C4E" py="40px">
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing="24px">
          {STATS.map((stat) => (
            <Box key={stat.label} textAlign="center">
              <Text fontSize={{ base: '28px', md: '36px' }} fontWeight="800" color="white">
                {stat.value}
              </Text>
              <Text fontSize="sm" color="whiteAlpha.700" mt="4px">
                {stat.label}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}

export default StatsBar;
