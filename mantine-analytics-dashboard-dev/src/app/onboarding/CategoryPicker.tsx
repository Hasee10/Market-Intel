'use client';

import { useState, useTransition } from 'react';

import { Alert, Button, Select, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { setPrimaryDomain } from './actions';

type Category = { id: string; slug: string; name: string };

type Props = {
  categories: Category[];
};

export function CategoryPicker({ categories }: Props) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!categoryId) {
      setError('Pick a category to continue');
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await setPrimaryDomain(categoryId);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        This decides which sellers you&apos;re benchmarked against on the Market page. You can
        change it later from Settings.
      </Text>

      {error && (
        <Alert icon={<IconAlertCircle size="1rem" />} color="red" title="Couldn't save">
          {error}
        </Alert>
      )}

      <Select
        label="Your domain"
        placeholder="Select a category"
        data={categories.map((c) => ({ value: c.id, label: c.name }))}
        value={categoryId}
        onChange={setCategoryId}
        searchable
        required
      />

      <Button onClick={handleSubmit} loading={isPending}>
        Continue
      </Button>
    </Stack>
  );
}
