'use client';

import { MdEdit, MdOutlineMail } from 'react-icons/md';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { CustomerDto } from '@/types/customer';

type CustomerCardProps = {
  data: CustomerDto;
  onEdit?: (customer: CustomerDto) => void;
};

// Was hardcoded to 'USD' regardless of the customer's actual currency -
// every non-USD customer showed a misleading $ sign on the wrong amount.
const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

export function CustomerCard({ data, onEdit }: CustomerCardProps) {
  return (
    <Card className="flex h-full flex-col">
      <p className="mb-1.5 truncate text-base font-bold text-gray-900 dark:text-white">
        {data.externalCustomerId || 'Customer'}
      </p>

      <p className="mb-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <MdOutlineMail className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{data.email || 'N/A'}</span>
      </p>

      <div className="mb-3 flex justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Orders</p>
          <p className="text-sm font-semibold text-gray-900 tabular-nums dark:text-white">
            {data.ordersCount}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Spent</p>
          <p className="text-sm font-semibold text-gray-900 tabular-nums dark:text-white">
            {formatCurrency(data.totalSpent, data.currency)}
          </p>
        </div>
      </div>

      <div className="mt-auto flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<MdEdit className="size-4" />}
          onClick={() => onEdit?.(data)}
        >
          Edit
        </Button>
      </div>
    </Card>
  );
}

export default CustomerCard;
