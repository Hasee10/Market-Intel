'use client';

import { ReactNode } from 'react';

import { Badge, Box, Button, Flex, Icon, Text, useColorModeValue } from '@chakra-ui/react';
import { MdLock } from 'react-icons/md';
import Link from 'next/link';

import ShinyText from 'components/reactbits/ShinyText';
import SpotlightCard from 'components/reactbits/SpotlightCard';

import { PATH_APPS } from '@/lib/paths';

type UpgradeGateProps = {
  hasAccess: boolean;
  requiredPlanLabel: string;
  featureName: string;
  children: ReactNode;
};

// Soft-gates a feature: shows the real content if the seller's plan_tier
// covers it (see entitlements.ts), otherwise a locked upsell card in its
// place. No payment flow behind "Upgrade" yet (see entitlements.ts's
// comment) - it links to Settings, where plan tier is visible, rather than
// pretending there's a working checkout.
export function UpgradeGate({ hasAccess, requiredPlanLabel, featureName, children }: UpgradeGateProps) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');

  if (hasAccess) return <>{children}</>;

  return (
    // The one screen in the app that is asking for money, so it earns the
    // spotlight treatment - a locked feature should still look like something
    // worth unlocking rather than a dead end.
    <SpotlightCard mb="20px">
      <Flex direction="column" align="center" textAlign="center" py="24px" gap="8px">
        <Icon as={MdLock} boxSize="24px" color="secondaryGray.600" />
        <Text fontSize="lg" fontWeight="700" color={textColor}>
          {featureName}
        </Text>
        <Badge colorScheme="brand">
          <ShinyText>{requiredPlanLabel} plan required</ShinyText>
        </Badge>
        <Text fontSize="sm" color="secondaryGray.600" maxW="420px">
          This feature isn&apos;t included on your current plan.
        </Text>
        <Box mt="8px">
          <Button as={Link} href={PATH_APPS.settings} variant="brand" size="sm">
            View plans in Settings
          </Button>
        </Box>
      </Flex>
    </SpotlightCard>
  );
}

export default UpgradeGate;
