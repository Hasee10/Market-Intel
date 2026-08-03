'use client';

import { Flex, Icon, SimpleGrid, Skeleton, Stat, StatLabel, StatNumber, Text, useColorModeValue } from '@chakra-ui/react';
import { MdArrowUpward, MdArrowDownward, MdTrendingFlat } from 'react-icons/md';
import IconBox from 'components/icons/IconBox';

import CountUp from 'components/reactbits/CountUp';
import Reveal from 'components/reactbits/Reveal';
import SpotlightCard from 'components/reactbits/SpotlightCard';

export type StatItem = {
  title: string;
  value: string;
  diff?: number;
  period?: string;
};

type StatsGridProps = {
  data: StatItem[];
  loading?: boolean;
  columns?: number;
};

export function StatsGrid({ data, loading, columns = 4 }: StatsGridProps) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const boxBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const brandColor = 'brand.500';

  if (loading) {
    return (
      <SimpleGrid columns={{ base: 1, sm: 2, xl: columns }} gap="20px" mb="20px">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height="90px" borderRadius="20px" />
        ))}
      </SimpleGrid>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, xl: columns }} gap="20px" mb="20px">
      {data.map((item, index) => {
        const diff = item.diff ?? 0;
        const trendIcon = diff < 0 ? MdArrowDownward : diff > 0 ? MdArrowUpward : MdTrendingFlat;
        // Previously this always rendered green via MiniStatistics, so a
        // decline was styled as if it were growth. Colour now follows the sign.
        const trendColor = diff < 0 ? 'red.500' : diff > 0 ? 'green.500' : 'secondaryGray.600';

        return (
          // Staggered so the row resolves left-to-right instead of popping in
          // as one block. 60ms is enough to read as a sequence without the
          // last tile feeling late.
          <Reveal key={item.title} delay={index * 60}>
            <SpotlightCard
              py="15px"
              h="100%"
              transition="transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease"
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
            >
              <Flex my="auto" h="100%" align="center">
                <IconBox
                  w="56px"
                  h="56px"
                  bg={boxBg}
                  icon={<Icon w="28px" h="28px" as={trendIcon} color={brandColor} />}
                />
                <Stat my="auto" ms="18px">
                  <StatLabel lineHeight="100%" color="secondaryGray.600" fontSize="sm">
                    {item.title}
                  </StatLabel>
                  <StatNumber color={textColor} fontSize="2xl">
                    <CountUp value={item.value} />
                  </StatNumber>
                  {(diff !== 0 || item.period) && (
                    <Flex align="center" gap="5px">
                      {diff !== 0 && (
                        <Text color={trendColor} fontSize="xs" fontWeight="700">
                          {diff > 0 ? '+' : ''}
                          {diff}%
                        </Text>
                      )}
                      {/* The caller's own period string, rendered as given -
                          MiniStatistics used to append a hardcoded "since last
                          month" after it, producing "+5% vs last week since
                          last month". */}
                      {item.period && (
                        <Text color="secondaryGray.600" fontSize="xs" fontWeight="400">
                          {item.period}
                        </Text>
                      )}
                    </Flex>
                  )}
                </Stat>
              </Flex>
            </SpotlightCard>
          </Reveal>
        );
      })}
    </SimpleGrid>
  );
}

export default StatsGrid;
