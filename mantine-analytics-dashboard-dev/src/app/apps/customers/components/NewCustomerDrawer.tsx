'use client';

import { useState } from 'react';

import {
  Button,
  Drawer,
  DrawerProps,
  LoadingOverlay,
  NumberInput,
  Stack,
  TextInput,
} from '@mantine/core';
import { isEmail, useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

interface NewCustomerFormValues {
  externalCustomerId: string;
  email: string;
  ordersCount: number;
  totalSpent: number;
}

type NewCustomerDrawerProps = Omit<DrawerProps, 'title' | 'children'> & {
  onCustomerCreated?: () => void;
};

export const NewCustomerDrawer = ({
  onCustomerCreated,
  ...drawerProps
}: NewCustomerDrawerProps) => {
  const [loading, setLoading] = useState(false);

  const form = useForm<NewCustomerFormValues>({
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

  const handleSubmit = async (values: NewCustomerFormValues) => {
    setLoading(true);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.message || 'Failed to create customer');
      }

      notifications.show({
        title: 'Success',
        message: 'Customer created successfully',
        color: 'green',
      });

      form.reset();
      drawerProps.onClose?.();
      onCustomerCreated?.();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to create customer',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer {...drawerProps} title="Add a customer" size="md">
      <LoadingOverlay visible={loading} />
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
          <Button type="submit" mt="md" loading={loading}>
            Add Customer
          </Button>
        </Stack>
      </form>
    </Drawer>
  );
};
