'use client';

import { Skeleton } from '@chakra-ui/react';

import { Card } from '@/components/ui/Card';
import { CustomersTable } from '@/components/marketintel/CustomersTable';

// See dashboard/overview/loading.tsx for why a Server Component route needs
// one of these. Two skeletons, matching the two things this page used to
// show loading state for independently: RetentionPanel's own Skeleton
// (unchanged - it kept that shape when it stopped self-fetching, see its
// own file) and the customer table's loading rows.
export default function Loading() {
  return (
    <>
      <Skeleton height="200px" borderRadius="16px" mb="20px" />
      <Card>
        <CustomersTable data={[]} loading />
      </Card>
    </>
  );
}
