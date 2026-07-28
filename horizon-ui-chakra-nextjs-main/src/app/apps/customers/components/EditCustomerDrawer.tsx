'use client';

import { useEffect, useState } from 'react';

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
  Stack,
  useToast,
} from '@chakra-ui/react';

import type { CustomerDto } from '@/types/customer';

type EditCustomerDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerDto | null;
  onCustomerUpdated?: () => void;
};

export function EditCustomerDrawer({
  isOpen,
  onClose,
  customer,
  onCustomerUpdated,
}: EditCustomerDrawerProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [externalCustomerId, setExternalCustomerId] = useState('');
  const [ordersCount, setOrdersCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    if (customer) {
      setEmail(customer.email || '');
      setExternalCustomerId(customer.externalCustomerId || '');
      setOrdersCount(customer.ordersCount || 0);
      setTotalSpent(customer.totalSpent || 0);
    }
  }, [customer]);

  const handleSubmit = async () => {
    if (!customer?.id) return;
    if (email && !/^\S+@\S+$/.test(email)) {
      toast({ title: 'Error', description: 'Invalid email', status: 'error' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, externalCustomerId, ordersCount, totalSpent }),
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to update customer');
      }

      toast({ title: 'Success', description: 'Customer updated successfully', status: 'success' });
      onClose();
      onCustomerUpdated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update customer',
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!customer?.id) return;
    if (!window.confirm('Are you sure you want to delete this customer?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to delete customer');
      }

      toast({ title: 'Success', description: 'Customer deleted successfully', status: 'success' });
      onClose();
      onCustomerUpdated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete customer',
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
        <DrawerHeader>Edit customer</DrawerHeader>
        <DrawerBody>
          {customer && (
            <Stack spacing="16px">
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="500">
                  Email
                </FormLabel>
                <Input
                  placeholder="customer@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="500">
                  External customer ID
                </FormLabel>
                <Input
                  placeholder="ID from your store platform"
                  value={externalCustomerId}
                  onChange={(e) => setExternalCustomerId(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="500">
                  Orders count
                </FormLabel>
                <NumberInput value={ordersCount} onChange={(_, v) => setOrdersCount(v || 0)} min={0}>
                  <NumberInputField />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="500">
                  Total spent
                </FormLabel>
                <NumberInput value={totalSpent} onChange={(_, v) => setTotalSpent(v || 0)} min={0}>
                  <NumberInputField />
                </NumberInput>
              </FormControl>
            </Stack>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Flex justify="space-between" w="100%">
            <Button colorScheme="red" variant="outline" onClick={handleDelete} isLoading={loading}>
              Delete Customer
            </Button>
            <Button variant="brand" onClick={handleSubmit} isLoading={loading}>
              Update Customer
            </Button>
          </Flex>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default EditCustomerDrawer;
