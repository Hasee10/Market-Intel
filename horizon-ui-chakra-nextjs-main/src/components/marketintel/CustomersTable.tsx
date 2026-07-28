'use client';

import { Button, Icon, Skeleton, Table, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import { MdEdit } from 'react-icons/md';

import type { CustomerDto } from '@/types/customer';

type CustomersTableProps = {
  data: CustomerDto[];
  loading?: boolean;
  onEdit?: (customer: CustomerDto) => void;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export function CustomersTable({ data, loading, onEdit }: CustomersTableProps) {
  return (
    <Table variant="simple">
      <Thead>
        <Tr>
          <Th>Customer</Th>
          <Th>Email</Th>
          <Th isNumeric>Orders</Th>
          <Th isNumeric>Total spent</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Tr key={`row-loading-${i}`}>
                <Td colSpan={5}>
                  <Skeleton height="20px" />
                </Td>
              </Tr>
            ))
          : data.map((customer) => (
              <Tr key={customer.id}>
                <Td>{customer.externalCustomerId || 'Customer'}</Td>
                <Td>{customer.email || 'N/A'}</Td>
                <Td isNumeric>{customer.ordersCount}</Td>
                <Td isNumeric>{formatCurrency(customer.totalSpent)}</Td>
                <Td>
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Icon as={MdEdit} />}
                    onClick={() => onEdit?.(customer)}
                  >
                    Edit
                  </Button>
                </Td>
              </Tr>
            ))}
      </Tbody>
    </Table>
  );
}

export default CustomersTable;
