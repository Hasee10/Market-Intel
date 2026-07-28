'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Drawer,
  DrawerProps,
  LoadingOverlay,
  NumberInput,
  Select,
  Stack,
  TextInput,
} from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

import { IProductCategory } from '@/types/products';

type NewProductDrawerProps = Omit<DrawerProps, 'title' | 'children'> & {
  onProductCreated?: () => void;
};

export const NewProductDrawer = ({
  onProductCreated,
  ...drawerProps
}: NewProductDrawerProps) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<
    { value: string; label: string }[]
  >([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const response = await fetch('/api/product-categories');
      const result = await response.json();

      if (result.succeeded && result.data) {
        const categoryOptions = result.data.map(
          (category: IProductCategory) => ({
            value: category.id,
            label: category.name,
          }),
        );
        setCategories(categoryOptions);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (drawerProps.opened) {
      fetchCategories();
    }
  }, [drawerProps.opened, fetchCategories]);

  const form = useForm({
    mode: 'controlled',
    initialValues: {
      title: '',
      sellPrice: 0,
      costPrice: 0,
      stockQty: 0,
      sku: '',
      categoryId: '',
    },
    validate: {
      title: isNotEmpty('Product title cannot be empty'),
      categoryId: isNotEmpty('Category cannot be empty'),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to create product');
      }

      notifications.show({
        title: 'Success',
        message: 'Product created successfully',
        color: 'green',
      });

      form.reset();
      drawerProps.onClose?.();
      onProductCreated?.();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to create product',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer {...drawerProps} title="Create a new product">
      <LoadingOverlay visible={loading} />
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            label="Title"
            placeholder="title"
            key={form.key('title')}
            {...form.getInputProps('title')}
            required
          />
          <NumberInput
            label="Sell price"
            placeholder="sell price"
            {...form.getInputProps('sellPrice')}
          />
          <NumberInput
            label="Cost price"
            placeholder="cost price"
            {...form.getInputProps('costPrice')}
          />
          <NumberInput
            label="Stock quantity"
            placeholder="stock quantity"
            {...form.getInputProps('stockQty')}
          />
          <TextInput
            label="SKU"
            placeholder="Stock Keeping Unit"
            {...form.getInputProps('sku')}
          />
          <Select
            label="Category"
            placeholder="Select category"
            data={categories}
            disabled={categoriesLoading}
            {...form.getInputProps('categoryId')}
            required
          />
          <Button type="submit" mt="md" loading={loading}>
            Create Product
          </Button>
        </Stack>
      </form>
    </Drawer>
  );
};

export default NewProductDrawer;
