'use client';

import { Button, Flex, Input, Text, useClipboard, useToast } from '@chakra-ui/react';
import { MdContentCopy } from 'react-icons/md';

import Card from 'components/card/Card';

import type { ReferralStats } from '@/lib/market-intel/seller/referrals';

// stats arrive as a prop from apps/settings/page.tsx's server fetch - this
// used to GET /api/referrals itself on mount. Null when that lookup failed:
// the page deliberately degrades this one card rather than failing outright,
// so a seller who can't load referral stats can still change their settings.
export function ReferralCard({ stats }: { stats: ReferralStats | null }) {
  const toast = useToast();
  const link = stats ? `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/signup?ref=${stats.code}` : '';
  const { onCopy, hasCopied } = useClipboard(link);

  if (!stats) return null;

  return (
    <Card>
      <Text fontSize="lg" fontWeight="600" mb="4px">
        Invite other sellers
      </Text>
      <Text fontSize="sm" color="secondaryGray.600" mb="16px">
        More sellers in your category means richer, more reliable benchmarks for everyone -
        including you. Refer 3 sellers who sign up and your plan is upgraded to Paid,
        automatically.
      </Text>

      {stats && (
        <>
          <Flex gap="8px" mb="12px">
            <Input value={link} isReadOnly fontSize="sm" />
            <Button
              leftIcon={<MdContentCopy />}
              onClick={() => {
                onCopy();
                toast({ status: 'success', title: 'Link copied' });
              }}
            >
              {hasCopied ? 'Copied' : 'Copy'}
            </Button>
          </Flex>
          <Flex gap="16px">
            <Text fontSize="sm" color="secondaryGray.600">
              <b>{stats.joinedCount}</b> joined
            </Text>
            <Text fontSize="sm" color="secondaryGray.600">
              <b>{stats.pendingCount}</b> pending
            </Text>
          </Flex>
        </>
      )}
    </Card>
  );
}

export default ReferralCard;
