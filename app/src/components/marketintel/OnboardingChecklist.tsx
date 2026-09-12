'use client';

import NextLink from 'next/link';
import {
  Box,
  Circle,
  Flex,
  Icon,
  Progress,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { MdCheck, MdChevronRight } from 'react-icons/md';

import Card from 'components/card/Card';
import { PATH_APPS, PATH_DASHBOARD } from '@/lib/paths';
import type { OnboardingStatus } from '@/lib/market-intel/seller/onboarding-status';

// 'hasDomain' isn't a step here anymore - dashboard/apps layout.tsx now
// redirects any seller without a category to /onboarding before they can
// reach this checklist at all, so it would always show as already done.
const STEPS: Array<{ key: keyof OnboardingStatus; label: string; href: string }> = [
  { key: 'hasProduct', label: 'Add your first product', href: PATH_APPS.products.root },
  { key: 'hasOrder', label: 'Record your first order', href: PATH_APPS.orders },
  { key: 'hasWatchlistItem', label: 'Track a competitor', href: PATH_DASHBOARD.watchlist },
  { key: 'hasPublicProfile', label: 'Opt in to peer benchmarking', href: PATH_APPS.settings },
];

// Treats the empty dashboard as the primary onboarding surface rather than
// just showing $0.00 everywhere with no next step - the highest-converting
// pattern for new users per current SaaS onboarding practice. Disappears
// entirely once every step is done, so it never becomes clutter for an
// established seller; never asks a seller to redo a step already completed
// (each check is a real query against their own data, not a client-side
// flag that could get out of sync).
// status arrives as a prop from dashboard/overview/page.tsx's server fetch -
// this used to GET /api/onboarding-status itself on mount, a fifth client
// round trip on the page whose seven-fetch waterfall was the whole point of
// 92fba75. Null when the lookup failed, which renders nothing: a checklist
// is an aid, and a missing one is better than an error on the dashboard.
export function OnboardingChecklist({ status }: { status: OnboardingStatus | null }) {
  const cardBg = useColorModeValue('white', 'navy.700');
  const doneBg = useColorModeValue('green.50', 'whiteAlpha.100');
  const pendingBorder = useColorModeValue('gray.100', 'whiteAlpha.100');

  if (!status) return null;

  const completedCount = STEPS.filter((s) => status[s.key]).length;
  if (completedCount === STEPS.length) return null;

  return (
    <Card mb="20px" bg={cardBg}>
      <Flex justify="space-between" align="center" mb="8px">
        <Text fontWeight="700" fontSize="lg">
          Getting started
        </Text>
        <Text fontSize="sm" color="secondaryGray.600">
          {completedCount}/{STEPS.length} done
        </Text>
      </Flex>
      <Progress
        value={(completedCount / STEPS.length) * 100}
        size="sm"
        borderRadius="full"
        colorScheme="brand"
        mb="16px"
      />
      <Flex direction="column" gap="4px">
        {STEPS.map((step) => {
          const done = status[step.key];
          const rowContent = (
            <>
              <Flex align="center" gap="10px">
                <Circle size="22px" bg={done ? 'green.400' : 'gray.100'} color="white">
                  {done && <Icon as={MdCheck} boxSize="14px" />}
                </Circle>
                <Text
                  fontSize="sm"
                  fontWeight="500"
                  color={done ? 'green.700' : undefined}
                  textDecoration={done ? 'line-through' : 'none'}
                >
                  {step.label}
                </Text>
              </Flex>
              {!done && <Icon as={MdChevronRight} boxSize="18px" color="secondaryGray.600" />}
            </>
          );

          // Two separate branches (not one Flex with a conditional `as`)
          // since Chakra's polymorphic `as` prop can't type-check `href`
          // against a component that might be a plain 'div'.
          if (done) {
            return (
              <Flex key={step.key} align="center" justify="space-between" p="10px" borderRadius="10px" bg={doneBg}>
                {rowContent}
              </Flex>
            );
          }

          return (
            <Flex
              key={step.key}
              as={NextLink}
              href={step.href}
              align="center"
              justify="space-between"
              p="10px"
              borderRadius="10px"
              border="1px solid"
              borderColor={pendingBorder}
              _hover={{ borderColor: 'brand.300' }}
              cursor="pointer"
            >
              {rowContent}
            </Flex>
          );
        })}
      </Flex>
    </Card>
  );
}

export default OnboardingChecklist;
