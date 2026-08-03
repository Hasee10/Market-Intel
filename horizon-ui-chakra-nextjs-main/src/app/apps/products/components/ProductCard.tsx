'use client';

import { Badge, Box, Button, Flex, Icon, Text, useColorModeValue } from '@chakra-ui/react';
import { MdEdit } from 'react-icons/md';

import Card from 'components/card/Card';
import { IProduct } from '@/types/products';

type ProductCardProps = {
  data: IProduct;
  onEdit?: (product: IProduct) => void;
};

// Was hardcoded to 'USD' regardless of the product's actual currency -
// every non-USD product showed a misleading $ sign on the wrong amount.
const formatCurrency = (amount: number | null, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount ?? 0);

// Same threshold Overview's "Low Stock Products" stat uses
// (api/ecommerce/stats/route.ts) - keeping this in sync means a product
// flagged low here is flagged low there too, not two different definitions
// of "low" on the same dashboard.
const LOW_STOCK_THRESHOLD = 10;

// Mirrors MIN_MARGIN_PCT in lib/market-intel/pricing-recommendation.ts (not
// importable here - that file is server-only). Same 15% floor the pricing
// recommendation engine already treats as the line between healthy and thin.
const HEALTHY_MARGIN_PCT = 0.15;

export function ProductCard({ data, onEdit }: ProductCardProps) {
  const cardBorder = useColorModeValue('gray.100', 'whiteAlpha.100');
  const cardShadow = useColorModeValue('0px 4px 16px rgba(17, 28, 78, 0.04)', 'none');
  const mutedColor = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const categoryBadgeBg = useColorModeValue('#F0EDFF', 'whiteAlpha.100');
  const categoryBadgeColor = useColorModeValue('#4318FF', '#A594FF');
  const lowStockColor = useColorModeValue('#DD6B20', '#FBB03B');
  const isLowStock = data.isActive && (data.stockQty ?? 0) < LOW_STOCK_THRESHOLD;

  const marginPct =
    data.costPrice && data.costPrice > 0 && data.sellPrice
      ? ((data.sellPrice - data.costPrice) / data.sellPrice) * 100
      : null;

  return (
    <Card
      border="1px solid"
      borderColor={cardBorder}
      boxShadow={cardShadow}
      transition="all 0.2s ease"
      _hover={{ transform: 'translateY(-3px)', boxShadow: '0px 16px 32px rgba(17, 28, 78, 0.08)' }}
    >
      <Flex justify="space-between" align="start" mb="10px">
        <Text fontSize="md" fontWeight="700" noOfLines={1}>
          {data.title}
        </Text>
        <Badge colorScheme={data.isActive ? 'green' : 'gray'} borderRadius="full" flexShrink={0} ml="8px">
          {data.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </Flex>

      <Flex align="center" gap="8px" mb="16px" wrap="wrap">
        <Badge borderRadius="full" px="10px" py="2px" fontSize="xs" fontWeight="600" bg={categoryBadgeBg} color={categoryBadgeColor}>
          {data.categoryName || 'Uncategorized'}
        </Badge>
        {data.sku && (
          <Text fontSize="xs" color={mutedColor}>
            SKU {data.sku}
          </Text>
        )}
      </Flex>

      <Flex justify="space-between" mb="16px">
        <Box>
          <Text fontSize="xs" color={mutedColor}>
            Sell price
          </Text>
          <Text fontSize="sm" fontWeight="600">
            {formatCurrency(data.sellPrice, data.currency)}
          </Text>
          {marginPct !== null && (
            <Text fontSize="xs" fontWeight="600" color={marginPct >= HEALTHY_MARGIN_PCT * 100 ? 'green.500' : 'orange.400'}>
              {marginPct.toFixed(0)}% margin
            </Text>
          )}
        </Box>
        <Box textAlign="right">
          <Text fontSize="xs" color={mutedColor}>
            Stock
          </Text>
          <Text fontSize="sm" fontWeight="600" color={isLowStock ? lowStockColor : undefined}>
            {data.stockQty ?? 0}
            {isLowStock && ' ⚠'}
          </Text>
        </Box>
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
