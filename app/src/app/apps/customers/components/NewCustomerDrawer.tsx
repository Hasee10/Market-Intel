'use client';

import { useState } from 'react';

// useToast only - see WatchlistView for why toasts stay on Chakra until the
// final removal.
import { useToast } from '@chakra-ui/react';

import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Field, Input, Select } from '@/components/ui/Field';
import { SUPPORTED_CURRENCIES } from '@/types/products';

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
  const [currency, setCurrency] = useState('PKR');

  const resetForm = () => {
    setEmail('');
    setExternalCustomerId('');
    setOrdersCount(0);
    setTotalSpent(0);
    setCurrency('PKR');
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
        body: JSON.stringify({ email, externalCustomerId, ordersCount, totalSpent, currency }),
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
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add a customer"
      footer={
        <Button className="w-full" onClick={handleSubmit} loading={loading}>
          Add Customer
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Email">
          <Input
            type="email"
            placeholder="customer@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="External customer ID">
          <Input
            placeholder="ID from your store platform"
            value={externalCustomerId}
            onChange={(e) => setExternalCustomerId(e.target.value)}
          />
        </Field>

        <Field label="Orders count">
          <Input
            type="number"
            min={0}
            value={ordersCount}
            onChange={(e) => setOrdersCount(Number(e.target.value) || 0)}
          />
        </Field>

        <div className="flex gap-3">
          <div className="flex-[2]">
            <Field label="Total spent">
              <Input
                type="number"
                min={0}
                value={totalSpent}
                onChange={(e) => setTotalSpent(Number(e.target.value) || 0)}
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
      </div>
    </Drawer>
  );
}

export default NewCustomerDrawer;
