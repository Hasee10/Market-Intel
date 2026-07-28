'use client';

import { useState } from 'react';

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
  Stack,
  useToast,
} from '@chakra-ui/react';

type NewCustomerDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated?: () => void;
};

export function NewCustomerDrawer({ isOpen, onClose, onCustomerCreated }: NewCustomerDrawerProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [externalCustomerId, setExternalCustomerId] = useState('');
  const [ordersCount, setOrdersCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  const resetForm = () => {
    setEmail('');
    setExternalCustomerId('');
    setOrdersCount(0);
    setTotalSpent(0);
  };

  const handleSubmit = async () => {
    if (email && !/^\S+@\S+$/.test(email)) {
      toast({ title: 'Error', description: 'Invalid email', status: 'error' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, externalCustomerId, ordersCount, totalSpent }),
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to create customer');
      }

      toast({ title: 'Success', description: 'Customer created successfully', status: 'success' });
      resetForm();
      onClose();
      onCustomerCreated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create customer',
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
        <DrawerHeader>Add a customer</DrawerHeader>
        <DrawerBody>
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
        </DrawerBody>
        <DrawerFooter>
          <Button variant="brand" w="100%" onClick={handleSubmit} isLoading={loading}>
            Add Customer
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default NewCustomerDrawer;
