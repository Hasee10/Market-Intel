'use client';

import { Grid, Skeleton } from '@chakra-ui/react';

// See dashboard/overview/loading.tsx for why a Server Component route needs
// one of these. Matches the original page's own Skeleton-wrapped-Card shape
// (three form cards + the two independently-loading DomainsManager/
// ReferralCard slots) rather than a generic spinner.
export default function Loading() {
  return (
    <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap="20px">
      <Skeleton height="320px" borderRadius="20px" />
      <Skeleton height="320px" borderRadius="20px" />
      <Skeleton height="200px" borderRadius="20px" />
      <Skeleton height="200px" borderRadius="20px" />
    </Grid>
  );
}
