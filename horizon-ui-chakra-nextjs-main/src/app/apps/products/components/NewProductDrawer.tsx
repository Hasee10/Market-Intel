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
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  Stack,
  useToast,
} from '@chakra-ui/react';

import { IProductCategory } from '@/types/products';

type NewProductDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated?: () => void;
};

export function NewProductDrawer({ isOpen, onClose, onProductCreated }: NewProductDrawerProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [sellPrice, setSellPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [stockQty, setStockQty] = useState(0);
  const [sku, setSku] = useState('');
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

  const resetForm = () => {
    setTitle('');
    setSellPrice(0);
    setCostPrice(0);
    setStockQty(0);
    setSku('');
    setCategoryId('');
  };

  const handleSubmit = async () => {
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
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, sellPrice, costPrice, stockQty, sku, categoryId }),
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to create product');
      }

      toast({ title: 'Success', description: 'Product created successfully', status: 'success' });
      resetForm();
      onClose();
      onProductCreated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create product',
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
        <DrawerHeader>Create a new product</DrawerHeader>
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
          </Stack>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="brand" w="100%" onClick={handleSubmit} isLoading={loading}>
            Create Product
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default NewProductDrawer;
