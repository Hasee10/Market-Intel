import { Button, Group, PaperProps, Stack, Text, Title } from '@mantine/core';
import { IconEdit, IconMail } from '@tabler/icons-react';

import { Surface } from '@/components';
import type { CustomerDto } from '@/types';

interface CustomerCardProps extends Omit<PaperProps, 'children'> {
  data: CustomerDto;
  onEdit?: (customer: CustomerDto) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    amount,
  );

export const CustomerCard = ({
  data,
  onEdit,
  ...paperProps
}: CustomerCardProps) => {
  return (
    <Surface p="md" {...paperProps}>
      <Stack gap="sm">
        <Title order={5}>{data.externalCustomerId || 'Customer'}</Title>

        <Group gap={6}>
          <IconMail size={14} color="gray" />
          <Text size="xs" c="dimmed">
            {data.email || 'N/A'}
          </Text>
        </Group>

        <Group justify="space-between" mt="xs">
          <div>
            <Text size="xs" c="dimmed">
              Orders
            </Text>
            <Text size="sm" fw={500}>
              {data.ordersCount}
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text size="xs" c="dimmed">
              Total Spent
            </Text>
            <Text size="sm" fw={500}>
              {formatCurrency(data.totalSpent)}
            </Text>
          </div>
        </Group>

        <Group justify="flex-end" mt="md">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconEdit size={14} />}
            onClick={() => onEdit && onEdit(data)}
          >
            Edit
          </Button>
        </Group>
      </Stack>
    </Surface>
  );
};
