'use client';

import { Box, Container, Divider, Flex, Icon, SimpleGrid, Text } from '@chakra-ui/react';
import { MdStorefront, MdCategory, MdSchedule, MdShield } from 'react-icons/md';
import { CountUp } from 'components/reactbits/CountUp';
import { Reveal } from 'components/reactbits/Reveal';

// Real, product-descriptive numbers (scraper coverage, refresh cadence) -
// deliberately not fake customer/user counts, since this product has no
// public user base to cite yet. Overstating traction here would be the
// kind of thing that erodes trust the moment someone checks.
const STATS = [
  { icon: MdStorefront, value: '11', label: 'Marketplaces tracked live' },
  { icon: MdCategory, value: '12', label: 'Seller categories supported' },
  { icon: MdSchedule, value: '48hrs', label: 'Max data refresh cycle' },
  { icon: MdShield, value: '0', label: 'Raw competitor data ever shown to you' },
];

export function StatsBar() {
  return (
    <Box position="relative" py={{ base: '0', md: '20px' }}>
      <Container maxW="1200px" px={{ base: '20px', md: '30px' }}>
        <Box
          position="relative"
          overflow="hidden"
          borderRadius="24px"
          bg="linear-gradient(135deg, #4318FF 0%, #7B61FF 100%)"
          px={{ base: '24px', md: '48px' }}
          py={{ base: '40px', md: '48px' }}
        >
          {/* Subtle decorative glow, not a flat dead block */}
          <Box
            position="absolute"
            top="-80px"
            right="-60px"
            w="240px"
            h="240px"
            borderRadius="full"
            bg="radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 70%)"
          />
          <Box
            position="absolute"
            bottom="-100px"
            left="10%"
            w="200px"
            h="200px"
            borderRadius="full"
            bg="radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%)"
          />

          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={{ base: '32px', md: '16px' }} position="relative">
            {STATS.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 80}>
                <Flex direction="column" align={{ base: 'flex-start', md: 'center' }} textAlign={{ base: 'left', md: 'center' }} position="relative">
                  {i > 0 && (
                    <Divider
                      orientation="vertical"
                      position="absolute"
                      left={{ base: 'auto', md: '-8px' }}
                      h="70%"
                      top="15%"
                      borderColor="whiteAlpha.300"
                      display={{ base: 'none', md: 'block' }}
                    />
                  )}
                  <Flex
                    w="40px"
                    h="40px"
                    borderRadius="10px"
                    bg="whiteAlpha.200"
                    align="center"
                    justify="center"
                    mb="12px"
                  >
                    <Icon as={stat.icon} boxSize="20px" color="white" />
                  </Flex>
                  <Text fontSize={{ base: '26px', md: '34px' }} fontWeight="800" color="white" lineHeight="1">
                    <CountUp value={stat.value} />
                  </Text>
                  <Text fontSize="sm" color="whiteAlpha.700" mt="6px" maxW="160px">
                    {stat.label}
                  </Text>
                </Flex>
              </Reveal>
            ))}
          </SimpleGrid>
        </Box>
      </Container>
    </Box>
  );
}

export default StatsBar;
