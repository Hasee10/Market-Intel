'use client';

import { MdEdit } from 'react-icons/md';

import { Table, THead, TH, TBody, TR, TD } from '@/components/ui/Table';
import type { CustomerDto } from '@/types/customer';

type CustomersTableProps = {
  data: CustomerDto[];
  loading?: boolean;
  onEdit?: (customer: CustomerDto) => void;
};

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

export function CustomersTable({ data, loading, onEdit }: CustomersTableProps) {
  return (
    <Table>
      <THead>
        <TH>Customer</TH>
        <TH>Email</TH>
        <TH numeric>Orders</TH>
        <TH numeric>Total spent</TH>
        <TH />
      </THead>
      <TBody>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <TR key={`row-loading-${i}`}>
                <TD colSpan={5}>
                  <span className="block h-5 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </TD>
              </TR>
            ))
          : data.map((customer) => (
              <TR key={customer.id}>
                <TD strong>{customer.externalCustomerId || 'Customer'}</TD>
                <TD>{customer.email || 'N/A'}</TD>
                <TD numeric>{customer.ordersCount}</TD>
                <TD numeric>{formatCurrency(customer.totalSpent, customer.currency)}</TD>
                <TD>
                  <button
                    type="button"
                    onClick={() => onEdit?.(customer)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    <MdEdit className="size-4" aria-hidden="true" />
                    Edit
                  </button>
                </TD>
              </TR>
            ))}
      </TBody>
    </Table>
  );
}

export default CustomersTable;
