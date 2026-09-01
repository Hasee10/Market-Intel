'use client';

import { useCallback, useEffect, useState } from 'react';

// useToast only - see WatchlistView for why toasts stay on Chakra.
import { useToast } from '@chakra-ui/react';

import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Field, Input, Select, Toggle } from '@/components/ui/Field';

import { IProduct, IProductCategory, SUPPORTED_CURRENCIES } from '@/types/products';

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
  const [currency, setCurrency] = useState('PKR');
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
      setCurrency(product.currency || 'PKR');
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
          currency,
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
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Edit product"
      footer={
        <div className="flex w-full justify-between">
          <Button variant="danger" onClick={handleDelete} loading={loading}>
            Delete Product
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Update Product
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Title" required>
          <Input placeholder="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <div className="flex gap-3">
          <div className="flex-[2]">
            <Field label="Sell price">
              <Input
                type="number"
                min={0}
                placeholder="sell price"
                value={sellPrice}
                onChange={(e) => setSellPrice(Number(e.target.value) || 0)}
              />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Currency">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <Field label="Cost price">
          <Input
            type="number"
            min={0}
            placeholder="cost price"
            value={costPrice}
            onChange={(e) => setCostPrice(Number(e.target.value) || 0)}
          />
        </Field>

        <Field label="Stock quantity">
          <Input
            type="number"
            min={0}
            placeholder="stock quantity"
            value={stockQty}
            onChange={(e) => setStockQty(Number(e.target.value) || 0)}
          />
        </Field>

        <Field label="SKU">
          <Input
            placeholder="Stock Keeping Unit"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
        </Field>

        <Field label="Category" required>
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={categoriesLoading}
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Toggle label="Active" checked={isActive} onChange={setIsActive} />
      </div>
    </Drawer>
  );
}

export default EditProductDrawer;
