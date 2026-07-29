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

import type { CustomerDto } from '@/types/customer';

type NewOrderDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: () => void;
};

export function NewOrderDrawer({ isOpen, onClose, onOrderCreated }: NewOrderDrawerProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [externalOrderId, setExternalOrderId] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalAmount, setTotalAmount] = useState(0);
  const [status, setStatus] = useState('completed');

  const fetchCustomers = useCallback(async () => {
    const response = await fetch('/api/customers');
    const result = await response.json();
    if (result.succeeded && result.data) setCustomers(result.data);
  }, []);

  useEffect(() => {
    if (isOpen) fetchCustomers();
  }, [isOpen, fetchCustomers]);

  const resetForm = () => {
    setCustomerId('');
    setExternalOrderId('');
    setOrderDate(new Date().toISOString().slice(0, 10));
    setTotalAmount(0);
    setStatus('completed');
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId || null,
          externalOrderId,
          orderDate,
          totalAmount,
          status,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.errors?.join(', ') || data.message || 'Failed to create order');
      }

      toast({ title: 'Success', description: 'Order created successfully', status: 'success' });
      resetForm();
      onClose();
      onOrderCreated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create order',
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
        <DrawerHeader>Add an order</DrawerHeader>
        <DrawerBody>
          <Stack spacing="16px">
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="500">
                Customer
              </FormLabel>
              <Select placeholder="Guest checkout" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.email || c.externalCustomerId || c.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="500">
                External order ID
              </FormLabel>
              <Input
                placeholder="ID from your store platform"
                value={externalOrderId}
                onChange={(e) => setExternalOrderId(e.target.value)}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm" fontWeight="500">
                Order date
              </FormLabel>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm" fontWeight="500">
                Total amount
              </FormLabel>
              <NumberInput value={totalAmount} onChange={(_, v) => setTotalAmount(v || 0)} min={0}>
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="500">
                Status
              </FormLabel>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </Select>
            </FormControl>
          </Stack>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="brand" w="100%" onClick={handleSubmit} isLoading={loading}>
            Add Order
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default NewOrderDrawer;
