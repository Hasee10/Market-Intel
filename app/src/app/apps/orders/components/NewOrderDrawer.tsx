'use client';

import { useCallback, useEffect, useState } from 'react';

// useToast only - see WatchlistView for why toasts stay on Chakra.
import { useToast } from '@chakra-ui/react';

import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';

import type { CustomerDto } from '@/types/customer';
import { SUPPORTED_CURRENCIES } from '@/types/products';

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
  const [currency, setCurrency] = useState('PKR');
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
    setCurrency('PKR');
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
          currency,
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
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add an order"
      footer={
        <Button className="w-full" onClick={handleSubmit} loading={loading}>
          Add Order
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Customer">
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {/* Empty option carries the same "Guest checkout" meaning Chakra's
                `placeholder` prop gave it - a native select has no equivalent. */}
            <option value="">Guest checkout</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.email || c.externalCustomerId || c.id.slice(0, 8)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="External order ID">
          <Input
            placeholder="ID from your store platform"
            value={externalOrderId}
            onChange={(e) => setExternalOrderId(e.target.value)}
          />
        </Field>

        <Field label="Order date" required>
          <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
        </Field>

        <div className="flex gap-3">
          <div className="flex-[2]">
            <Field label="Total amount" required>
              <Input
                type="number"
                min={0}
                value={totalAmount}
                onChange={(e) => setTotalAmount(Number(e.target.value) || 0)}
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

        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </Select>
        </Field>
      </div>
    </Drawer>
  );
}

export default NewOrderDrawer;
