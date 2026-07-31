'use client';

import NextLink from 'next/link';
import { Flex, Icon, Text, useColorModeValue } from '@chakra-ui/react';
import { MdChevronRight } from 'react-icons/md';

import Card from 'components/card/Card';
import { IProductCategory } from '@/types/products';

import { getCategoryVisual } from './categoryVisuals';

type ProductCategoryCardProps = {
  data: IProductCategory;
};

export function CategoryCard({ data }: ProductCategoryCardProps) {
  const { icon, color } = getCategoryVisual(data.slug);
  const isEmpty = data.productCount === 0;

  const cardBorder = useColorModeValue('gray.100', 'whiteAlpha.100');
  const emptyTextColor = useColorModeValue('secondaryGray.500', 'secondaryGray.600');
  const activeTextColor = useColorModeValue('secondaryGray.900', 'white');
  const arrowColor = useColorModeValue('secondaryGray.400', 'whiteAlpha.400');

  return (
    <Card
      as={NextLink}
      href={`/apps/products?categoryId=${data.id}&categoryName=${encodeURIComponent(data.name)}`}
      border="1px solid"
      borderColor={cardBorder}
      opacity={isEmpty ? 0.7 : 1}
      transition="all 0.15s ease"
      cursor="pointer"
      _hover={{
        borderColor: color,
        boxShadow: `0px 12px 24px ${color}26`,
        transform: 'translateY(-3px)',
        opacity: 1,
      }}
    >
      <Flex justify="space-between" align="flex-start">
        <Flex
          w="44px"
          h="44px"
          borderRadius="12px"
          align="center"
          justify="center"
          mb="16px"
          bg={`${color}1F`}
        >
          <Icon as={icon} boxSize="22px" color={color} />
        </Flex>
        <Icon as={MdChevronRight} boxSize="18px" color={arrowColor} mt="10px" />
      </Flex>
      <Text fontSize="md" fontWeight="700" mb="4px" color={activeTextColor}>
        {data.name}
      </Text>
      <Text fontSize="sm" color={isEmpty ? emptyTextColor : color} fontWeight={isEmpty ? '400' : '600'}>
        {data.productCount} product{data.productCount === 1 ? '' : 's'}
      </Text>
    </Card>
  );
}

export default CategoryCard;
