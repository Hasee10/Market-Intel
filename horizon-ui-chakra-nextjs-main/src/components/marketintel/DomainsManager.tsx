'use client';

import { useState } from 'react';

import {
  Badge,
  Button,
  Flex,
  Icon,
  Select,
  Skeleton,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { MdDelete, MdStar, MdStarBorder } from 'react-icons/md';

import Card from 'components/card/Card';

import { useFetch } from '@/lib/hooks/useApi';
import { IApiResponse } from '@/types/api-response';
import type { SellerDomainRow } from '@/lib/market-intel/seller';

type Category = { id: string; slug: string; name: string };
type DomainsData = { domains: SellerDomainRow[]; categories: Category[] };

export function DomainsManager() {
  const toast = useToast();
  const { data, loading, refetch } = useFetch<IApiResponse<DomainsData>>('/api/domains');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const domains = data?.data?.domains ?? [];
  const categories = data?.data?.categories ?? [];
  const availableCategories = categories.filter((c) => !domains.some((d) => d.categoryId === c.id));

  const handleAdd = async () => {
    if (!selectedCategory) return;
    setAdding(true);
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: selectedCategory }),
      });
      const result = await response.json();
      if (!response.ok || !result.succeeded) throw new Error(result.errors?.join(', ') || 'Failed to add domain');
      setSelectedCategory('');
      refetch();
    } catch (error) {
      toast({ status: 'error', title: error instanceof Error ? error.message : 'Failed to add domain' });
    } finally {
      setAdding(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/domains/${id}`, { method: 'PATCH' });
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/domains/${id}`, { method: 'DELETE' });
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <Skeleton height="180px" borderRadius="16px" />;
  }

  return (
    <Card>
      <Text fontSize="lg" fontWeight="600" mb="4px">
        Domains
      </Text>
      <Text fontSize="sm" color="secondaryGray.600" mb="16px">
        You can track multiple categories - benchmarks and peers on the Market page always use
        your primary domain.
      </Text>

      <Stack spacing="8px" mb="16px">
        {domains.length === 0 && (
          <Text fontSize="sm" color="secondaryGray.600">
            No domains yet.
          </Text>
        )}
        {domains.map((domain) => (
          <Flex key={domain.id} justify="space-between" align="center" p="8px" borderRadius="8px" bg="secondaryGray.100">
            <Flex align="center" gap="8px">
              <Text fontSize="sm" fontWeight="600">
                {domain.categoryName}
              </Text>
              {domain.isPrimary && <Badge colorScheme="brand">Primary</Badge>}
            </Flex>
            <Flex gap="4px">
              {!domain.isPrimary && (
                <Button
                  size="xs"
                  variant="ghost"
                  leftIcon={<Icon as={MdStarBorder} />}
                  isLoading={busyId === domain.id}
                  onClick={() => handleSetPrimary(domain.id)}
                >
                  Make primary
                </Button>
              )}
              {domain.isPrimary && <Icon as={MdStar} color="brand.500" />}
              <Button
                size="xs"
                variant="ghost"
                colorScheme="red"
                leftIcon={<Icon as={MdDelete} />}
                isLoading={busyId === domain.id}
                onClick={() => handleRemove(domain.id)}
              >
                Remove
              </Button>
            </Flex>
          </Flex>
        ))}
      </Stack>

      <Flex gap="8px">
        <Select
          placeholder="Add a category"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          isDisabled={availableCategories.length === 0}
        >
          {availableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button variant="brand" onClick={handleAdd} isLoading={adding} isDisabled={!selectedCategory}>
          Add
        </Button>
      </Flex>
    </Card>
  );
}

export default DomainsManager;
