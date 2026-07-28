'use client';

import { Badge, Button, Flex, Icon, Text } from '@chakra-ui/react';
import { MdEdit } from 'react-icons/md';

import Card from 'components/card/Card';
import { IProduct } from '@/types/products';

type ProductCardProps = {
  data: IProduct;
  onEdit?: (product: IProduct) => void;
};

const formatCurrency = (amount: number | null) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0);

export function ProductCard({ data, onEdit }: ProductCardProps) {
  return (
    <Card>
      <Flex justify="space-between" align="start" mb="8px">
        <Text fontSize="md" fontWeight="700" noOfLines={1}>
          {data.title}
        </Text>
        <Badge colorScheme={data.isActive ? 'green' : 'gray'}>
          {data.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </Flex>
      <Text fontSize="xs" color="secondaryGray.600" mb="12px">
        {data.categoryName || 'Uncategorized'} {data.sku ? `- SKU ${data.sku}` : ''}
      </Text>

      <Flex justify="space-between" mb="16px">
        <div>
          <Text fontSize="xs" color="secondaryGray.600">
            Sell price
          </Text>
          <Text fontSize="sm" fontWeight="600">
            {formatCurrency(data.sellPrice)}
          </Text>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Text fontSize="xs" color="secondaryGray.600">
            Stock
          </Text>
          <Text fontSize="sm" fontWeight="600">
            {data.stockQty ?? 0}
          </Text>
        </div>
      </Flex>

      <Flex justify="flex-end">
        <Button size="sm" variant="ghost" leftIcon={<Icon as={MdEdit} />} onClick={() => onEdit?.(data)}>
          Edit
        </Button>
      </Flex>
    </Card>
  );
}

export default ProductCard;
