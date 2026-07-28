import { Group, PaperProps, Text, Title } from '@mantine/core';

import { Surface } from '@/components';
import { IProductCategory } from '@/types/products';

interface ProductCategoryCardProps extends Omit<PaperProps, 'children'> {
  data: IProductCategory;
}

export const CategoryCard = ({ data }: ProductCategoryCardProps) => {
  return (
    <Surface p="md">
      <Title order={4} mb="xs">
        {data.name}
      </Title>
      <Group>
        <Text size="sm">Your products: {data.productCount}</Text>
      </Group>
    </Surface>
  );
};
