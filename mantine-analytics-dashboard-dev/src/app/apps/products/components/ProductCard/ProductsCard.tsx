'use client';

import { Badge, Button, Group, PaperProps, Text, Title } from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';

import { Surface } from '@/components';
import { IProduct } from '@/types/products';

interface ProductsCardProps extends Omit<PaperProps, 'children'> {
  data: IProduct;
  onEdit?: (product: IProduct) => void;
}

export function ProductsCard({ data, onEdit, ...props }: ProductsCardProps) {
  return (
    <Surface {...props}>
      <Group justify="space-between" mb="xs">
        <Title order={4}>{data.title}</Title>
        <Badge color={data.isActive ? 'green' : 'red'}>
          {data.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </Group>

      <Group>
        <Text fw={500}>
          Price:{' '}
          {data.sellPrice != null ? `$${data.sellPrice.toFixed(2)}` : 'N/A'}
        </Text>
        <Text>Stock: {data.stockQty ?? 'N/A'}</Text>
      </Group>

      <Text size="sm" mt="md">
        Category: {data.categoryName || 'Uncategorized'}
      </Text>

      <Text size="xs" c="dimmed" mt="sm" mb="md">
        SKU: {data.sku || 'N/A'}
      </Text>

      <Group justify="flex-end">
        <Button
          variant="subtle"
          leftSection={<IconEdit size={16} />}
          onClick={() => onEdit && onEdit(data)}
        >
          Edit
        </Button>
      </Group>
    </Surface>
  );
}

export default ProductsCard;
