'use client';

import { Badge, Button, Flex, Icon, Skeleton, Table, Tbody, Td, Th, Thead, Tr, useColorModeValue } from '@chakra-ui/react';
import { MdEdit, MdStorefront } from 'react-icons/md';

import type { IProduct } from '@/types/products';

type ProductsTableProps = {
  data: IProduct[];
  loading?: boolean;
  onEdit?: (product: IProduct) => void;
  onViewCompetitors?: (product: IProduct) => void;
};

const formatCurrency = (amount: number | null, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount ?? 0);

// Same threshold Overview's "Low Stock Products" stat uses
// (api/ecommerce/stats/route.ts), so a product flagged low here is flagged
// low there too instead of two different definitions of "low" on the same
// dashboard.
const LOW_STOCK_THRESHOLD = 10;

export function ProductsTable({ data, loading, onEdit, onViewCompetitors }: ProductsTableProps) {
  const rowHoverBg = useColorModeValue('#FAFAFF', 'whiteAlpha.50');
  const titleColor = useColorModeValue('secondaryGray.900', 'white');
  const categoryBadgeBg = useColorModeValue('#F0EDFF', 'whiteAlpha.100');
  const categoryBadgeColor = useColorModeValue('#4318FF', '#A594FF');
  const lowStockColor = useColorModeValue('#DD6B20', '#FBB03B');

  return (
    <Table variant="simple">
      <Thead>
        <Tr>
          <Th>Product</Th>
          <Th>SKU</Th>
          <Th>Category</Th>
          <Th isNumeric>Sell price</Th>
          <Th isNumeric>Stock</Th>
          <Th>Status</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Tr key={`row-loading-${i}`}>
                <Td colSpan={7}>
                  <Skeleton height="20px" />
                </Td>
              </Tr>
            ))
          : data.map((product) => {
              const isLowStock = product.isActive && (product.stockQty ?? 0) < LOW_STOCK_THRESHOLD;
              return (
                <Tr key={product.id} transition="background-color 0.15s ease" _hover={{ bg: rowHoverBg }}>
                  <Td fontWeight="600" color={titleColor}>
                    {product.title}
                  </Td>
                  <Td>{product.sku || 'N/A'}</Td>
                  <Td>
                    <Badge borderRadius="full" px="10px" py="2px" fontSize="xs" fontWeight="600" bg={categoryBadgeBg} color={categoryBadgeColor}>
                      {product.categoryName || 'Uncategorized'}
                    </Badge>
                  </Td>
                  <Td isNumeric>{formatCurrency(product.sellPrice, product.currency)}</Td>
                  <Td isNumeric color={isLowStock ? lowStockColor : undefined} fontWeight={isLowStock ? '700' : '400'}>
                    {product.stockQty ?? 0}
                    {isLowStock && ' ⚠'}
                  </Td>
                  <Td>
                    <Badge colorScheme={product.isActive ? 'green' : 'gray'} borderRadius="full">
                      {product.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <Flex gap="4px">
                      <Button size="sm" variant="ghost" leftIcon={<Icon as={MdEdit} />} onClick={() => onEdit?.(product)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<Icon as={MdStorefront} />}
                        onClick={() => onViewCompetitors?.(product)}
                      >
                        Competitors
                      </Button>
                    </Flex>
                  </Td>
                </Tr>
              );
            })}
      </Tbody>
    </Table>
  );
}

export default ProductsTable;
