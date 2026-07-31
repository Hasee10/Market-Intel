'use client';

import NextLink from 'next/link';
import { Badge, Flex, Icon, Text, useColorModeValue } from '@chakra-ui/react';
import { MdOutlineWorkspacePremium } from 'react-icons/md';

import { useFetch } from '@/lib/hooks/useApi';
import { PATH_APPS } from '@/lib/paths';
import type { IApiResponse } from '@/types/api-response';

const TIER_LABEL: Record<string, string> = { free: 'Free plan', paid: 'Paid plan', premium: 'Premium plan' };
const TIER_COLOR: Record<string, string> = { free: 'gray', paid: 'blue', premium: 'purple' };

// Fills what was otherwise dead space at the bottom of the sidebar with
// something a seller would actually want to see - what plan they're on,
// and a direct path to the referral upgrade loop (lib/market-intel/
// referrals.ts) if they're not already on the top tier. Fetches its own
// data (a plain GET to /api/profile) rather than needing plan tier threaded
// down through AdminShell/Sidebar/Content's prop chain.
export function PlanBadge({ isCollapsed }: { isCollapsed?: boolean }) {
  const { data } = useFetch<IApiResponse<{ planTier: string }>>('/api/profile');
  const planTier = data?.data?.planTier ?? 'free';
  const borderColor = useColorModeValue('gray.100', 'whiteAlpha.100');
  const bg = useColorModeValue('secondaryGray.100', 'whiteAlpha.50');

  if (isCollapsed) return null;

  return (
    <Flex
      as={NextLink}
      href={PATH_APPS.settings}
      direction="column"
      gap="6px"
      mx="14px"
      mb="16px"
      p="14px"
      borderRadius="14px"
      border="1px solid"
      borderColor={borderColor}
      bg={bg}
      _hover={{ borderColor: 'brand.400' }}
      transition="border-color 0.15s ease"
    >
      <Flex align="center" justify="space-between">
        <Badge colorScheme={TIER_COLOR[planTier] ?? 'gray'} borderRadius="full" px="10px" fontSize="10px">
          {TIER_LABEL[planTier] ?? 'Free plan'}
        </Badge>
        <Icon as={MdOutlineWorkspacePremium} color="brand.400" boxSize="16px" />
      </Flex>
      {planTier === 'free' && (
        <Text fontSize="xs" color="secondaryGray.600">
          Refer 3 sellers to unlock Paid, free.
        </Text>
      )}
      {planTier === 'paid' && (
        <Text fontSize="xs" color="secondaryGray.600">
          Go Premium for forecasting & pricing recommendations.
        </Text>
      )}
    </Flex>
  );
}

export default PlanBadge;
