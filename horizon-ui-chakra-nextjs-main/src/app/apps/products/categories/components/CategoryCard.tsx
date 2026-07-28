import { Text } from '@chakra-ui/react';

import Card from 'components/card/Card';
import { IProductCategory } from '@/types/products';

type ProductCategoryCardProps = {
  data: IProductCategory;
};

export function CategoryCard({ data }: ProductCategoryCardProps) {
  return (
    <Card>
      <Text fontSize="md" fontWeight="700" mb="8px">
        {data.name}
      </Text>
      <Text fontSize="sm" color="secondaryGray.600">
        Your products: {data.productCount}
      </Text>
    </Card>
  );
}

export default CategoryCard;
