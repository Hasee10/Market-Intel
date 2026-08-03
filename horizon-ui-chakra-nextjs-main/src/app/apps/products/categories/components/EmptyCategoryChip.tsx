'use client';

import NextLink from 'next/link';
import { Flex, Icon, Text, useColorModeValue } from '@chakra-ui/react';
import { MdAddCircleOutline } from 'react-icons/md';

import { IProductCategory } from '@/types/products';

import { getCategoryVisual } from './categoryVisuals';

// Compact treatment for categories with zero products - a full CategoryCard
// carries a product count, a share bar, and a tinted background, none of
// which mean anything at zero. Giving an empty category the same visual
// weight as one with real inventory was the actual "flat" problem on this
// page: 7 of 12 categories looked exactly as important as the 5 that had
// something to show. This is deliberately a single-line chip instead.
export function EmptyCategoryChip({ data }: { data: IProductCategory }) {
  const { icon, color } = getCategoryVisual(data.slug);
  const border = useColorModeValue('gray.200', 'whiteAlpha.200');
  const textColor = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const hoverBorder = useColorModeValue('gray.300', 'whiteAlpha.400');
  const plusColor = useColorModeValue('secondaryGray.400', 'whiteAlpha.400');

  return (
    <Flex
      as={NextLink}
      href={`/apps/products?categoryId=${data.id}&categoryName=${encodeURIComponent(data.name)}`}
      align="center"
      gap="8px"
      pl="10px"
      pr="14px"
      py="8px"
      borderRadius="full"
      border="1px dashed"
      borderColor={border}
      transition="all 0.15s ease"
      _hover={{ borderColor: hoverBorder, borderStyle: 'solid' }}
    >
      <Icon as={icon} boxSize="15px" color={color} opacity={0.7} />
      <Text fontSize="sm" color={textColor} fontWeight="500">
        {data.name}
      </Text>
      <Icon as={MdAddCircleOutline} boxSize="14px" color={plusColor} />
    </Flex>
  );
}

export default EmptyCategoryChip;
