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
  HStack,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  Stack,
  useToast,
} from '@chakra-ui/react';

import type { CustomerDto } from '@/types/customer';
import type { OrderDto } from '@/types/order';

type EditOrderDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDto | null;
  onOrderUpdated?: () => void;
};

export function EditOrderDrawer({ isOpen, onClose, order, onOrderUpdated }: EditOrderDrawerProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [externalOrderId, setExternalOrderId] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [status, setStatus] = useState('completed');

  const fetchCustomers = useCallback(async () => {
    const response = await fetch('/api/customers');
    const result = await response.json();
    if (result.succeeded && result.data) setCustomers(result.data);
  }, []);

  useEffect(() => {
    if (!isOpen || !order) return;
    fetchCustomers();
    setCustomerId(order.customerId || '');
    setExternalOrderId(order.externalOrderId || '');
    setOrderDate(order.orderDate.slice(0, 10));
    setTotalAmount(order.totalAmount);
    setStatus(order.status || 'completed');
  }, [isOpen, order, fetchCustomers]);

  const handleSubmit = async () => {
    if (!order) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
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
        throw new Error(data.errors?.join(', ') || data.message || 'Failed to update order');
      }

      toast({ title: 'Success', description: 'Order updated successfully', status: 'success' });
      onClose();
      onOrderUpdated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update order',
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.errors?.join(', ') || data.message || 'Failed to delete order');
      }

      toast({ title: 'Success', description: 'Order deleted successfully', status: 'success' });
      onClose();
      onOrderUpdated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete order',
        status: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Edit order</DrawerHeader>
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
              <Input value={externalOrderId} onChange={(e) => setExternalOrderId(e.target.value)} />
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
          <HStack w="100%">
            <Button variant="outline" colorScheme="red" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
            <Button variant="brand" flex="1" onClick={handleSubmit} isLoading={loading}>
              Save Changes
            </Button>
          </HStack>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default EditOrderDrawer;
