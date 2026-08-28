'use client';

import { useState, useTransition } from 'react';

import {
  Alert,
  AlertIcon,
  Button,
  FormControl,
  FormLabel,
  Select,
  Stack,
  Text,
} from '@chakra-ui/react';

import Card from 'components/card/Card';

import { setPrimaryDomain } from './actions';
import { SUPPORTED_COUNTRIES } from '@/lib/market-intel/countries';

type Category = { id: string; slug: string; name: string };

type Props = {
  categories: Category[];
};

export function CategoryPicker({ categories }: Props) {
  const [categoryId, setCategoryId] = useState<string>('');
  // Pre-filled to Pakistan - the existing seller base is overwhelmingly
  // there, so onboarding stays a glance-and-continue "one quick step" for
  // most sellers rather than turning into a second decision to make.
  const [country, setCountry] = useState<string>('PK');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!categoryId) {
      setError('Pick a category to continue');
      return;
    }

    setError(null);
    startTransition(() => {
      (async () => {
        const result = await setPrimaryDomain(categoryId, country);
        if (result?.error) {
          setError(result.error);
        }
      })();
    });
  };

  return (
    <Card maxW="560px">
      <Stack spacing="16px">
        <Text fontSize="sm" color="secondaryGray.600">
          This decides which sellers you&apos;re benchmarked against on the Market page. You can
          change it later from Settings.
        </Text>

        {error && (
          <Alert status="error" borderRadius="12px">
            <AlertIcon />
            {error}
          </Alert>
        )}

        <FormControl>
          <FormLabel fontSize="sm" fontWeight="500">
            Country
          </FormLabel>
          <Select value={country} onChange={(e) => setCountry(e.target.value)}>
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm" fontWeight="500">
            Your domain
          </FormLabel>
          <Select
            placeholder="Select a category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormControl>

        <Button variant="brand" onClick={handleSubmit} isLoading={isPending} w="fit-content">
          Continue
        </Button>
      </Stack>
    </Card>
  );
}

export default CategoryPicker;
