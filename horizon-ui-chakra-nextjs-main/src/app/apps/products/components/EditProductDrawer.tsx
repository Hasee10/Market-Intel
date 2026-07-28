'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  Stack,
  Switch,
  useToast,
} from '@chakra-ui/react';

import { IProduct, IProductCategory } from '@/types/products';

type EditProductDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  product: IProduct | null;
  onProductUpdated?: () => void;
};

export function EditProductDrawer({
  isOpen,
  onClose,
  product,
  onProductUpdated,
}: EditProductDrawerProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [sellPrice, setSellPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [stockQty, setStockQty] = useState(0);
  const [sku, setSku] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [categoryId, setCategoryId] = useState('');

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const response = await fetch('/api/product-categories');
      const result = await response.json();

      if (result.succeeded && result.data) {
        setCategories(
          result.data.map((category: IProductCategory) => ({
            value: category.id,
            label: category.name,
          })),
        );
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen, fetchCategories]);

  useEffect(() => {
    if (product) {
      setTitle(product.title || '');
      setSellPrice(product.sellPrice ?? 0);
      setCostPrice(product.costPrice ?? 0);
      setStockQty(product.stockQty ?? 0);
      setSku(product.sku || '');
      setIsActive(product.isActive);
      setCategoryId(product.categoryId || '');
    }
  }, [product]);

  const handleSubmit = async () => {
    if (!product) return;
    if (!title.trim()) {
      toast({ title: 'Error', description: 'Product title cannot be empty', status: 'error' });
      return;
    }
    if (!categoryId) {
      toast({ title: 'Error', description: 'Category cannot be empty', status: 'error' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          sellPrice,
          costPrice,
          stockQty,
          sku,
          isActive,
          categoryId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to update product');
      }

      toast({ title: 'Success', description: 'Product updated successfully', status: 'success' });
      onClose();
      onProductUpdated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update product',
        status: 'error',
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
      const response = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to delete product');
      }

      toast({ title: 'Success', description: 'Product deleted successfully', status: 'success' });
      onClose();
      onProductUpdated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete product',
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Edit product</DrawerHeader>
        <DrawerBody>
          <Stack spacing="16px">
            <FormControl isRequired>
              <FormLabel fontSize="sm" fontWeight="500">
                Title
              </FormLabel>
              <Input placeholder="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="500">
                Sell price
              </FormLabel>
              <NumberInput value={sellPrice} onChange={(_, v) => setSellPrice(v || 0)} min={0}>
                <NumberInputField placeholder="sell price" />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="500">
                Cost price
              </FormLabel>
              <NumberInput value={costPrice} onChange={(_, v) => setCostPrice(v || 0)} min={0}>
                <NumberInputField placeholder="cost price" />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="500">
                Stock quantity
              </FormLabel>
              <NumberInput value={stockQty} onChange={(_, v) => setStockQty(v || 0)} min={0}>
                <NumberInputField placeholder="stock quantity" />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="500">
                SKU
              </FormLabel>
              <Input
                placeholder="Stock Keeping Unit"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm" fontWeight="500">
                Category
              </FormLabel>
              <Select
                placeholder="Select category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                isDisabled={categoriesLoading}
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </FormControl>
            <Flex align="center" justify="space-between">
              <FormLabel mb="0" fontSize="sm" fontWeight="500">
                Active
              </FormLabel>
              <Switch
                isChecked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                colorScheme="brand"
              />
            </Flex>
          </Stack>
        </DrawerBody>
        <DrawerFooter>
          <Flex justify="space-between" w="100%">
            <Button colorScheme="red" variant="outline" onClick={handleDelete} isLoading={loading}>
              Delete Product
            </Button>
            <Button variant="brand" onClick={handleSubmit} isLoading={loading}>
              Update Product
            </Button>
          </Flex>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default EditProductDrawer;
