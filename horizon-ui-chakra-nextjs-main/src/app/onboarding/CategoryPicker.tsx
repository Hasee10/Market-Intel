'use client';

import { useState, useTransition } from 'react';

import {
  Alert,
  AlertIcon,
  Badge,
  Button,
  Flex,
  FormControl,
  FormLabel,
  IconButton,
  Select,
  Stack,
  Text,
} from '@chakra-ui/react';
import { MdClose } from 'react-icons/md';

import Card from 'components/card/Card';

import { completeOnboarding } from './actions';
import { SUPPORTED_COUNTRIES } from '@/lib/market-intel/countries';

type Category = { id: string; slug: string; name: string };

const MAX_DOMAINS = 3;

type Props = {
  categories: Category[];
  /** Whether the seller's plan allows more than one domain (multi_domain feature). */
  allowMultipleDomains: boolean;
};

export function CategoryPicker({ categories, allowMultipleDomains }: Props) {
  // categoryIds[0] is always the primary domain. Starts with a single empty
  // slot; "Add another domain" appends up to MAX_DOMAINS.
  const [categoryIds, setCategoryIds] = useState<string[]>(['']);
  // Pre-filled to Pakistan - the existing seller base is overwhelmingly
  // there, so onboarding stays a glance-and-continue "one quick step" for
  // most sellers rather than turning into a second decision to make.
  const [country, setCountry] = useState<string>('PK');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canAddMore = allowMultipleDomains && categoryIds.length < MAX_DOMAINS;

  const handleSlotChange = (index: number, value: string) => {
    setCategoryIds((prev) => prev.map((id, i) => (i === index ? value : id)));
  };

  const handleAddSlot = () => {
    if (!canAddMore) return;
    setCategoryIds((prev) => [...prev, '']);
  };

  const handleRemoveSlot = (index: number) => {
    setCategoryIds((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const picked = categoryIds.filter(Boolean);
    if (picked.length === 0) {
      setError('Pick a category to continue');
      return;
    }

    setError(null);
    startTransition(() => {
      (async () => {
        const result = await completeOnboarding(picked, country);
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
          This decides which sellers you&apos;re benchmarked against on the Market page. The first
          domain is your primary; you can add more now or later from Settings.
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

        <Stack spacing="10px">
          {categoryIds.map((categoryId, index) => (
            <FormControl key={index}>
              <FormLabel fontSize="sm" fontWeight="500">
                {index === 0 ? 'Your primary domain' : `Domain ${index + 1}`}
              </FormLabel>
              <Flex gap="8px">
                <Select
                  placeholder="Select a category"
                  value={categoryId}
                  onChange={(e) => handleSlotChange(index, e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                {index > 0 && (
                  <IconButton
                    aria-label="Remove domain"
                    icon={<MdClose />}
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveSlot(index)}
                  />
                )}
              </Flex>
            </FormControl>
          ))}
        </Stack>

        {categoryIds.length < MAX_DOMAINS && (
          <Flex align="center" gap="8px">
            <Button size="sm" variant="outline" onClick={handleAddSlot} isDisabled={!canAddMore}>
              + Add another domain
            </Button>
            {!allowMultipleDomains && <Badge colorScheme="brand">Premium: track more domains</Badge>}
          </Flex>
        )}

        <Button variant="brand" onClick={handleSubmit} isLoading={isPending} w="fit-content">
          Continue
        </Button>
      </Stack>
    </Card>
  );
}

export default CategoryPicker;
