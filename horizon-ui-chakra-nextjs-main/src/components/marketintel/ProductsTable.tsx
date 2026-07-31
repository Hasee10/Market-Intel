'use client';

import { Badge, Button, Icon, Skeleton, Table, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import { MdEdit } from 'react-icons/md';

import type { IProduct } from '@/types/products';

type ProductsTableProps = {
  data: IProduct[];
  loading?: boolean;
  onEdit?: (product: IProduct) => void;
};

const formatCurrency = (amount: number | null, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount ?? 0);

export function ProductsTable({ data, loading, onEdit }: ProductsTableProps) {
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
          : data.map((product) => (
              <Tr key={product.id}>
                <Td>{product.title}</Td>
                <Td>{product.sku || 'N/A'}</Td>
                <Td>{product.categoryName || 'Uncategorized'}</Td>
                <Td isNumeric>{formatCurrency(product.sellPrice, product.currency)}</Td>
                <Td isNumeric>{product.stockQty ?? 0}</Td>
                <Td>
                  <Badge colorScheme={product.isActive ? 'green' : 'gray'}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td>
                  <Button size="sm" variant="ghost" leftIcon={<Icon as={MdEdit} />} onClick={() => onEdit?.(product)}>
                    Edit
                  </Button>
                </Td>
              </Tr>
            ))}
      </Tbody>
    </Table>
  );
}

export default ProductsTable;
