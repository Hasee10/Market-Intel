'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  Badge,
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
  Icon,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  Stack,
  useToast,
} from '@chakra-ui/react';
import { MdAutoAwesome } from 'react-icons/md';

import { IProductCategory, SUPPORTED_CURRENCIES } from '@/types/products';

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
  const [suggesting, setSuggesting] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [sellPrice, setSellPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [currency, setCurrency] = useState('PKR');
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
    setCurrency('PKR');
    setStockQty(0);
    setSku('');
    setCategoryId('');
    setAiConfidence(null);
  };

  // silent=true is used by the auto-trigger effect below - a background
  // suggestion firing while the seller is still typing shouldn't pop a
  // warning toast just because the title was momentarily too short.
  const runSuggestCategory = useCallback(
    async (currentTitle: string, silent = false) => {
      if (!currentTitle.trim()) {
        if (!silent) toast({ title: 'Enter a title first', status: 'warning' });
        return;
      }

      setSuggesting(true);
      setAiConfidence(null);
      try {
        const response = await fetch('/api/products/suggest-category', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: currentTitle }),
        });
        const result = await response.json();

        if (!response.ok || !result.succeeded) {
          // 503 = GROQ_API_KEY not configured yet - a real, expected state
          // until that key is added, not a bug to alarm the seller about.
          // Silent (auto) failures don't need a toast at all - the seller
          // can still pick a category manually with no explanation needed.
          if (!silent) {
            toast({
              title: response.status === 503 ? 'AI suggestions not enabled yet' : 'Could not suggest a category',
              description: result.message,
              status: response.status === 503 ? 'info' : 'error',
            });
          }
          return;
        }

        setCategoryId(result.data.categoryId);
        setAiConfidence(result.data.confidence);
        if (!silent) toast({ title: `Suggested: ${result.data.categoryName}`, status: 'success' });
      } catch (error) {
        if (!silent) toast({ title: 'Could not suggest a category', status: 'error' });
      } finally {
        setSuggesting(false);
      }
    },
    [toast],
  );

  const handleSuggestCategory = () => runSuggestCategory(title);

  // Auto-assigns a category as the seller types, so picking one manually
  // becomes the exception rather than a required step. Debounced so it
  // doesn't fire on every keystroke, and only while no category is set yet
  // - once the seller has one (manually chosen or already suggested), typing
  // more into the title doesn't fight that choice.
  useEffect(() => {
    if (!isOpen || categoryId || title.trim().length < 2) return;
    const timer = setTimeout(() => runSuggestCategory(title, true), 600);
    return () => clearTimeout(timer);
  }, [isOpen, title, categoryId, runSuggestCategory]);

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
        body: JSON.stringify({ title, sellPrice, costPrice, currency, stockQty, sku, categoryId }),
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
            <Flex gap="12px">
              <FormControl flex="2">
                <FormLabel fontSize="sm" fontWeight="500">
                  Sell price
                </FormLabel>
                <NumberInput value={sellPrice} onChange={(_, v) => setSellPrice(v || 0)} min={0}>
                  <NumberInputField placeholder="sell price" />
                </NumberInput>
              </FormControl>
              <FormControl flex="1">
                <FormLabel fontSize="sm" fontWeight="500">
                  Currency
                </FormLabel>
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </Flex>
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
              <Flex justify="space-between" align="center" mb="2px">
                <FormLabel fontSize="sm" fontWeight="500" mb="0">
                  Category
                </FormLabel>
                <Flex align="center" gap="6px">
                  {aiConfidence && (
                    <Badge colorScheme={aiConfidence === 'high' ? 'green' : aiConfidence === 'medium' ? 'orange' : 'gray'}>
                      AI: {aiConfidence}
                    </Badge>
                  )}
                  <Button
                    size="xs"
                    variant="ghost"
                    leftIcon={<Icon as={MdAutoAwesome} />}
                    onClick={handleSuggestCategory}
                    isLoading={suggesting}
                  >
                    Suggest with AI
                  </Button>
                </Flex>
              </Flex>
              <Select
                placeholder="Select category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setAiConfidence(null);
                }}
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
