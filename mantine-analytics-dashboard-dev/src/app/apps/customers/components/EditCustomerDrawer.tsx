'use client';

import { useEffect, useState } from 'react';

import {
  Button,
  Drawer,
  DrawerProps,
  Group,
  LoadingOverlay,
  NumberInput,
  Stack,
  TextInput,
} from '@mantine/core';
import { isEmail, useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

import type { CustomerDto } from '@/types';

interface EditCustomerFormValues {
  externalCustomerId: string;
  email: string;
  ordersCount: number;
  totalSpent: number;
}

type EditCustomerDrawerProps = Omit<DrawerProps, 'title' | 'children'> & {
  customer: CustomerDto | null;
  onCustomerUpdated?: () => void;
};

export const EditCustomerDrawer = ({
  customer,
  onCustomerUpdated,
  ...drawerProps
}: EditCustomerDrawerProps) => {
  const [loading, setLoading] = useState(false);

  const form = useForm<EditCustomerFormValues>({
    mode: 'controlled',
    initialValues: {
      externalCustomerId: '',
      email: '',
      ordersCount: 0,
      totalSpent: 0,
    },
    validate: {
      email: isEmail('Invalid email'),
    },
  });

  useEffect(() => {
    if (customer) {
      form.setValues({
        externalCustomerId: customer.externalCustomerId || '',
        email: customer.email || '',
        ordersCount: customer.ordersCount || 0,
        totalSpent: customer.totalSpent || 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  const handleSubmit = async (values: EditCustomerFormValues) => {
    if (!customer?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to update customer');
      }

      notifications.show({
        title: 'Success',
        message: 'Customer updated successfully',
        color: 'green',
      });

      drawerProps.onClose?.();
      onCustomerUpdated?.();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to update customer',
        color: 'red',
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
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to delete customer');
      }

      notifications.show({
        title: 'Success',
        message: 'Customer deleted successfully',
        color: 'green',
      });

      drawerProps.onClose?.();
      onCustomerUpdated?.();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to delete customer',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer {...drawerProps} title="Edit customer" size="md">
      <LoadingOverlay visible={loading} />
      {customer && (
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="customer@email.com"
              key={form.key('email')}
              {...form.getInputProps('email')}
            />
            <TextInput
              label="External customer ID"
              placeholder="ID from your store platform"
              key={form.key('externalCustomerId')}
              {...form.getInputProps('externalCustomerId')}
            />
            <NumberInput
              label="Orders count"
              {...form.getInputProps('ordersCount')}
            />
            <NumberInput
              label="Total spent"
              {...form.getInputProps('totalSpent')}
            />

            <Group justify="space-between" mt="xl">
              <Button color="red" onClick={handleDelete} variant="outline">
                Delete Customer
              </Button>
              <Button type="submit" loading={loading}>
                Update Customer
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Drawer>
  );
};
