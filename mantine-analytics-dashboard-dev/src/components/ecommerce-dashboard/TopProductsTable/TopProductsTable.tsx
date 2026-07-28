import { Badge, Group, Progress, Skeleton, Stack, Table, Text } from '@mantine/core';
import { ErrorAlert } from '@/components';

interface Product {
  id: string;
  title: string;
  sku: string;
  category: string;
  sellPrice: number;
  stockQty: number;
  inventoryValue: number;
}

interface TopProductsTableProps {
  data?: Product[];
  loading?: boolean;
  error?: Error | null;
}

export const TopProductsTable: React.FC<TopProductsTableProps> = ({
  data = [],
  loading = false,
  error = null,
}) => {
  if (error) {
    return (
      <ErrorAlert
        title="Error loading products"
        message={error.message || 'Failed to load top products'}
      />
    );
  }

  if (loading) {
    return (
      <Stack gap="sm">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={`product-loading-${i}`} height={60} radius="sm" />
        ))}
      </Stack>
    );
  }

  if (!data.length) {
    return (
      <Text size="sm" c="dimmed">
        No active products yet.
      </Text>
    );
  }

  const maxValue = Math.max(...data.map((p) => p.inventoryValue), 1);

  const rows = data.map((product) => (
    <Table.Tr key={product.id}>
      <Table.Td>
        <Text size="sm" fw={500}>
          {product.title}
        </Text>
        <Text size="xs" c="dimmed">
          {product.sku || 'No SKU'}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge variant="light" color="blue">
          {product.category}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm">${product.sellPrice.toFixed(2)}</Text>
      </Table.Td>
      <Table.Td>
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            ${product.inventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
          <Progress value={(product.inventoryValue / maxValue) * 100} size="xs" color="blue" />
        </Stack>
      </Table.Td>
      <Table.Td>
        <Badge
          variant="light"
          color={product.stockQty > 100 ? 'teal' : product.stockQty > 50 ? 'yellow' : 'red'}
        >
          {product.stockQty} units
        </Badge>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Table.ScrollContainer minWidth={700}>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Product</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Price</Table.Th>
            <Table.Th>Inventory Value</Table.Th>
            <Table.Th>Stock</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
};
