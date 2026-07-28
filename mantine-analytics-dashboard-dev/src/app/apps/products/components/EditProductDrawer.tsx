'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Drawer,
  DrawerProps,
  Group,
  LoadingOverlay,
  NumberInput,
  Select,
  Stack,
  Switch,
  TextInput,
} from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

import { IProduct, IProductCategory } from '@/types/products';

type EditProductDrawerProps = Omit<DrawerProps, 'title' | 'children'> & {
  product: IProduct | null;
  onProductUpdated?: () => void;
};

export const EditProductDrawer = ({
  product,
  onProductUpdated,
  ...drawerProps
}: EditProductDrawerProps) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<
    { value: string; label: string }[]
  >([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const form = useForm({
    mode: 'controlled',
    initialValues: {
      title: '',
      sellPrice: 0,
      costPrice: 0,
      stockQty: 0,
      sku: '',
      isActive: true,
      categoryId: '',
    },
    validate: {
      title: isNotEmpty('Product title cannot be empty'),
      categoryId: isNotEmpty('Category cannot be empty'),
    },
  });

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

  useEffect(() => {
    if (product) {
      form.setValues({
        title: product.title || '',
        sellPrice: product.sellPrice ?? 0,
        costPrice: product.costPrice ?? 0,
        stockQty: product.stockQty ?? 0,
        sku: product.sku || '',
        isActive: product.isActive,
        categoryId: product.categoryId || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const handleSubmit = async (values: typeof form.values) => {
    if (!product) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to update product');
      }

      notifications.show({
        title: 'Success',
        message: 'Product updated successfully',
        color: 'green',
      });

      drawerProps.onClose?.();
      onProductUpdated?.();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to update product',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to delete product');
      }

      notifications.show({
        title: 'Success',
        message: 'Product deleted successfully',
        color: 'green',
      });

      drawerProps.onClose?.();
      onProductUpdated?.();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to delete product',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer {...drawerProps} title="Edit product">
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
          <Switch
            label="Active"
            {...form.getInputProps('isActive', { type: 'checkbox' })}
          />

          <Group justify="space-between" mt="xl">
            <Button color="red" onClick={handleDelete}>
              Delete Product
            </Button>
            <Button type="submit">Update Product</Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
};

export default EditProductDrawer;
