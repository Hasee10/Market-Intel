'use client';

import { Icon, SimpleGrid, Skeleton } from '@chakra-ui/react';
import { MdArrowUpward, MdArrowDownward, MdTrendingFlat } from 'react-icons/md';
import MiniStatistics from 'components/card/MiniStatistics';
import IconBox from 'components/icons/IconBox';

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
  const brandColor = 'brand.500';
  const boxBg = 'secondaryGray.300';

  if (loading) {
    return (
      <SimpleGrid columns={{ base: 1, sm: 2, xl: columns }} gap="20px" mb="20px">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height="90px" borderRadius="16px" />
        ))}
      </SimpleGrid>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, xl: columns }} gap="20px" mb="20px">
      {data.map((item) => {
        const diff = item.diff ?? 0;
        const growth =
          diff !== 0
            ? `${diff > 0 ? '+' : ''}${diff}%${item.period ? ` ${item.period}` : ''}`
            : item.period;
        return (
          <MiniStatistics
            key={item.title}
            startContent={
              <IconBox
                w="56px"
                h="56px"
                bg={boxBg}
                icon={
                  <Icon
                    w="28px"
                    h="28px"
                    as={diff < 0 ? MdArrowDownward : diff > 0 ? MdArrowUpward : MdTrendingFlat}
                    color={brandColor}
                  />
                }
              />
            }
            name={item.title}
            value={item.value}
            growth={growth}
          />
        );
      })}
    </SimpleGrid>
  );
}

export default StatsGrid;
