'use client';

import { useEffect, useState } from 'react';

// useToast only - see WatchlistView for why toasts stay on Chakra.
import { useToast } from '@chakra-ui/react';

import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Field, Input, Select } from '@/components/ui/Field';

import type { CustomerDto } from '@/types/customer';
import { SUPPORTED_CURRENCIES } from '@/types/products';

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
  const [currency, setCurrency] = useState('PKR');

  useEffect(() => {
    if (customer) {
      setEmail(customer.email || '');
      setExternalCustomerId(customer.externalCustomerId || '');
      setOrdersCount(customer.ordersCount || 0);
      setTotalSpent(customer.totalSpent || 0);
      setCurrency(customer.currency || 'PKR');
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
        body: JSON.stringify({ email, externalCustomerId, ordersCount, totalSpent, currency }),
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
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Edit customer"
      footer={
        <div className="flex w-full justify-between">
          <Button variant="danger" onClick={handleDelete} loading={loading}>
            Delete Customer
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Update Customer
          </Button>
        </div>
      }
    >
      {customer && (
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
      )}
    </Drawer>
  );
}

export default EditCustomerDrawer;
