'use client';

import { useCallback, useEffect, useState } from 'react';

// useToast only - see WatchlistView for why toasts stay on Chakra.
import { useToast } from '@chakra-ui/react';

import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';

import type { CustomerDto } from '@/types/customer';
import type { OrderDto } from '@/types/order';
import { SUPPORTED_CURRENCIES } from '@/types/products';

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
  const [currency, setCurrency] = useState('PKR');
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
    setCurrency(order.currency || 'PKR');
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
          currency,
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
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Edit order"
      footer={
        <div className="flex w-full gap-2">
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
          <Button className="flex-1" onClick={handleSubmit} loading={loading}>
            Save Changes
          </Button>
        </div>
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
          <Input value={externalOrderId} onChange={(e) => setExternalOrderId(e.target.value)} />
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

export default EditOrderDrawer;
