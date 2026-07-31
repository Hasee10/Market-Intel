'use client';

import { Button, Flex, Icon, Text } from '@chakra-ui/react';
import { MdEdit, MdOutlineMail } from 'react-icons/md';

import Card from 'components/card/Card';
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
    <Card>
      <Text fontSize="md" fontWeight="700" mb="6px">
        {data.externalCustomerId || 'Customer'}
      </Text>

      <Flex align="center" gap="6px" mb="12px">
        <Icon as={MdOutlineMail} color="secondaryGray.600" boxSize="14px" />
        <Text fontSize="xs" color="secondaryGray.600">
          {data.email || 'N/A'}
        </Text>
      </Flex>

      <Flex justify="space-between" mb="12px">
        <div>
          <Text fontSize="xs" color="secondaryGray.600">
            Orders
          </Text>
          <Text fontSize="sm" fontWeight="600">
            {data.ordersCount}
          </Text>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Text fontSize="xs" color="secondaryGray.600">
            Total Spent
          </Text>
          <Text fontSize="sm" fontWeight="600">
            {formatCurrency(data.totalSpent, data.currency)}
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

export default CustomerCard;
