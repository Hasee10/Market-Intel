'use client';

import NextLink from 'next/link';
import { Box, Flex, Icon, Text, useColorModeValue } from '@chakra-ui/react';
import { MdChevronRight } from 'react-icons/md';

import Card from 'components/card/Card';
import { IProductCategory } from '@/types/products';

import { getCategoryVisual } from './categoryVisuals';

type ProductCategoryCardProps = {
  data: IProductCategory;
  /** Highest productCount among the populated categories on this page, so
   * the share bar reads as "how big relative to my biggest category" rather
   * than an arbitrary absolute scale. */
  maxProductCount: number;
};

// Only rendered for categories that actually have products - see page.tsx,
// which now routes productCount === 0 categories to the separate compact
// chip row instead of a full card. A tile carrying real data can afford a
// tinted background and a share bar; one that doesn't would just be
// decoration around a zero.
export function CategoryCard({ data, maxProductCount }: ProductCategoryCardProps) {
  const { icon, color } = getCategoryVisual(data.slug);

  const cardBorder = useColorModeValue('gray.100', 'whiteAlpha.100');
  const activeTextColor = useColorModeValue('secondaryGray.900', 'white');
  const arrowColor = useColorModeValue('secondaryGray.400', 'whiteAlpha.400');
  const barTrack = useColorModeValue('gray.100', 'whiteAlpha.100');

  const sharePct = maxProductCount > 0 ? Math.max((data.productCount / maxProductCount) * 100, 6) : 0;

  return (
    <Card
      as={NextLink}
      href={`/apps/products?categoryId=${data.id}&categoryName=${encodeURIComponent(data.name)}`}
      border="1px solid"
      borderColor={cardBorder}
      bg={`linear-gradient(160deg, ${color}14 0%, transparent 55%)`}
      transition="all 0.2s ease"
      cursor="pointer"
      _hover={{
        borderColor: color,
        boxShadow: `0px 12px 28px ${color}29`,
        transform: 'translateY(-3px)',
      }}
    >
      <Flex justify="space-between" align="flex-start">
        <Flex w="44px" h="44px" borderRadius="12px" align="center" justify="center" mb="16px" bg={`${color}1F`}>
          <Icon as={icon} boxSize="22px" color={color} />
        </Flex>
        <Icon as={MdChevronRight} boxSize="18px" color={arrowColor} mt="10px" />
      </Flex>
      <Text fontSize="md" fontWeight="700" mb="4px" color={activeTextColor}>
        {data.name}
      </Text>
      <Text fontSize="sm" color={color} fontWeight="600" mb="12px">
        {data.productCount} product{data.productCount === 1 ? '' : 's'}
      </Text>
      <Box h="4px" borderRadius="full" bg={barTrack} overflow="hidden">
        <Box h="100%" borderRadius="full" bg={color} w={`${sharePct}%`} transition="width 0.4s ease" />
      </Box>
    </Card>
  );
}

export default CategoryCard;
