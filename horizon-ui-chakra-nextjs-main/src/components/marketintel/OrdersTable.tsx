'use client';

import { MdEdit } from 'react-icons/md';

import { Table, THead, TH, TBody, TR, TD, Pill } from '@/components/ui/Table';
import type { OrderDto } from '@/types/order';

type OrdersTableProps = {
  data: OrderDto[];
  loading?: boolean;
  onEdit?: (order: OrderDto) => void;
};

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    amount,
  );

// Status tone is semantic, not decorative - cancelled must not read the same
// as completed at a glance.
const STATUS_TONES: Record<string, string> = {
  completed: 'success',
  pending: 'warning',
  cancelled: 'error',
  refunded: 'neutral',
};

export function OrdersTable({ data, loading, onEdit }: OrdersTableProps) {
  return (
    <Table minWidth={640}>
      <THead>
        <TH>Order</TH>
        <TH>Customer</TH>
        <TH>Date</TH>
        <TH numeric>Amount</TH>
        <TH>Status</TH>
        <TH />
      </THead>
      <TBody>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <TR key={`row-loading-${i}`}>
                <TD colSpan={6}>
                  <span className="block h-5 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </TD>
              </TR>
            ))
          : data.map((order) => (
              <TR key={order.id}>
                <TD strong>{order.externalOrderId || order.id.slice(0, 8)}</TD>
                <TD>{order.customerLabel || 'Guest'}</TD>
                <TD>{new Date(order.orderDate).toLocaleDateString()}</TD>
                <TD numeric>{formatCurrency(order.totalAmount, order.currency)}</TD>
                <TD>
                  <Pill tone={STATUS_TONES[order.status ?? ''] ?? 'neutral'}>
                    {order.status ?? 'unknown'}
                  </Pill>
                </TD>
                <TD>
                  <button
                    type="button"
                    onClick={() => onEdit?.(order)}
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

export default OrdersTable;
