'use client';

import { Badge, Button, Icon, Skeleton, Table, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import { MdEdit } from 'react-icons/md';

import type { OrderDto } from '@/types/order';

type OrdersTableProps = {
  data: OrderDto[];
  loading?: boolean;
  onEdit?: (order: OrderDto) => void;
};

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

const STATUS_COLORS: Record<string, string> = {
  completed: 'green',
  pending: 'orange',
  cancelled: 'red',
  refunded: 'gray',
};

export function OrdersTable({ data, loading, onEdit }: OrdersTableProps) {
  return (
    <Table variant="simple">
      <Thead>
        <Tr>
          <Th>Order</Th>
          <Th>Customer</Th>
          <Th>Date</Th>
          <Th isNumeric>Amount</Th>
          <Th>Status</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Tr key={`row-loading-${i}`}>
                <Td colSpan={6}>
                  <Skeleton height="20px" />
                </Td>
              </Tr>
            ))
          : data.map((order) => (
              <Tr key={order.id}>
                <Td>{order.externalOrderId || order.id.slice(0, 8)}</Td>
                <Td>{order.customerLabel || 'Guest'}</Td>
                <Td>{new Date(order.orderDate).toLocaleDateString()}</Td>
                <Td isNumeric>{formatCurrency(order.totalAmount, order.currency)}</Td>
                <Td>
                  <Badge colorScheme={STATUS_COLORS[order.status ?? ''] ?? 'gray'}>
                    {order.status ?? 'unknown'}
                  </Badge>
                </Td>
                <Td>
                  <Button size="sm" variant="ghost" leftIcon={<Icon as={MdEdit} />} onClick={() => onEdit?.(order)}>
                    Edit
                  </Button>
                </Td>
              </Tr>
            ))}
      </Tbody>
    </Table>
  );
}

export default OrdersTable;
