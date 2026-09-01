'use client';

import { Flex, Icon, SimpleGrid, Skeleton, Stat, StatLabel, StatNumber, Text, useColorMode, useColorModeValue } from '@chakra-ui/react';
import {
  MdArrowUpward,
  MdArrowDownward,
  MdTrendingFlat,
  MdOutlineAttachMoney,
  MdOutlineShoppingCart,
  MdOutlineReceiptLong,
  MdOutlineGroup,
  MdOutlineInsertChartOutlined,
  MdOutlineRemoveShoppingCart,
} from 'react-icons/md';
import type { IconType } from 'react-icons';
import IconBox from 'components/icons/IconBox';

import CountUp from 'components/reactbits/CountUp';
import Reveal from 'components/reactbits/Reveal';
import SpotlightCard from 'components/reactbits/SpotlightCard';

export type StatItem = {
  title: string;
  value: string;
  diff?: number;
  period?: string;
  /** Matches app/api/ecommerce/stats/route.ts's icon keys - unrecognized or
   *  omitted falls back to the trend-direction arrow (unchanged behaviour). */
  icon?: string;
  /** Chakra colour name - unrecognized or omitted falls back to the flat
   *  neutral box every card used to render (unchanged behaviour). */
  color?: string;
};

// Phase 2 (enterprise-look pass): every card used to render the exact same
// grey box + trend-arrow icon regardless of what it measured - Revenue,
// Orders, AOV and New Customers were only distinguishable by reading the
// label text. The API has computed a per-stat icon/colour since it was
// first written; this was the one place that data was received and
// silently dropped. Non-technical users scan by shape and colour before
// they read - four visually distinct chips is a real "instant insight"
// win, not just decoration.
const ICON_MAP: Record<string, IconType> = {
  'currency-dollar': MdOutlineAttachMoney,
  'shopping-cart': MdOutlineShoppingCart,
  receipt: MdOutlineReceiptLong,
  users: MdOutlineGroup,
  'chart-line': MdOutlineInsertChartOutlined,
  'shopping-cart-off': MdOutlineRemoveShoppingCart,
};

// [light, dark] pairs, picked by colorMode rather than useColorModeValue
// per item - this map is read inside data.map(), and calling a hook a
// variable number of times (once per row) breaks the rules of hooks the
// moment `data.length` changes between renders (e.g. loading -> loaded).
const COLOR_MAP: Record<string, { bg: [string, string]; icon: [string, string] }> = {
  blue: { bg: ['#EBF3FF', 'rgba(66, 133, 244, 0.12)'], icon: ['#2563EB', '#7DA9FF'] },
  teal: { bg: ['#E6FBF6', 'rgba(5, 205, 153, 0.12)'], icon: ['#05966B', '#3DDC97'] },
  orange: { bg: ['#FFF3E6', 'rgba(255, 181, 71, 0.14)'], icon: ['#B4740A', '#FFB547'] },
  pink: { bg: ['#FDECF3', 'rgba(238, 93, 172, 0.12)'], icon: ['#C23A80', '#F783BB'] },
  violet: { bg: ['#F1EEFF', 'rgba(139, 92, 246, 0.14)'], icon: ['#6D28D9', '#B79CFF'] },
  red: { bg: ['#FDECEA', 'rgba(238, 93, 80, 0.12)'], icon: ['#C23A2E', '#EE5D50'] },
};

type StatsGridProps = {
  data: StatItem[];
  loading?: boolean;
  columns?: number;
};

export function StatsGrid({ data, loading, columns = 4 }: StatsGridProps) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const fallbackBoxBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const brandColor = 'brand.500';
  const cardBorder = useColorModeValue('gray.100', 'whiteAlpha.100');
  const cardShadow = useColorModeValue('0px 4px 16px rgba(17, 28, 78, 0.04)', 'none');
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';

  if (loading) {
    return (
      <SimpleGrid columns={{ base: 1, sm: 2, xl: columns }} gap="14px" mb="16px">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height="76px" borderRadius="10px" />
        ))}
      </SimpleGrid>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, xl: columns }} gap="14px" mb="16px">
      {data.map((item, index) => {
        const diff = item.diff ?? 0;
        const trendIcon = diff < 0 ? MdArrowDownward : diff > 0 ? MdArrowUpward : MdTrendingFlat;
        // Previously this always rendered green via MiniStatistics, so a
        // decline was styled as if it were growth. Colour now follows the sign.
        const trendColor = diff < 0 ? 'red.500' : diff > 0 ? 'green.500' : 'secondaryGray.600';

        const palette = item.color ? COLOR_MAP[item.color] : undefined;
        const iconComponent = (item.icon && ICON_MAP[item.icon]) || trendIcon;
        const iconBoxBg = palette ? palette.bg[dark ? 1 : 0] : fallbackBoxBg;
        const iconColor = palette ? palette.icon[dark ? 1 : 0] : brandColor;

        return (
          // Staggered so the row resolves left-to-right instead of popping in
          // as one block. 60ms is enough to read as a sequence without the
          // last tile feeling late.
          <Reveal key={item.title} delay={index * 60}>
            <SpotlightCard
              py="12px"
              h="100%"
              border="1px solid"
              borderColor={cardBorder}
              boxShadow={cardShadow}
              transition="transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease"
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
            >
              <Flex my="auto" h="100%" align="center">
                <IconBox
                  w="44px"
                  h="44px"
                  bg={iconBoxBg}
                  icon={<Icon w="22px" h="22px" as={iconComponent} color={iconColor} />}
                />
                <Stat my="auto" ms="14px">
                  <StatLabel lineHeight="100%" color="secondaryGray.600" fontSize="xs">
                    {item.title}
                  </StatLabel>
                  <StatNumber color={textColor} fontSize="xl">
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
