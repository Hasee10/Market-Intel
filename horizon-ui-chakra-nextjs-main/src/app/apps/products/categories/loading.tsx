'use client';

import { SimpleGrid, Skeleton } from '@chakra-ui/react';

// Same eight-tile skeleton this page rendered inline while its one client
// fetch was loading, before this became a Server Component - see
// dashboard/overview/loading.tsx for why a route needs one of these at all.
// Kept in Chakra, matching the rest of this still-unmigrated page.
export default function Loading() {
  return (
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="20px">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={`category-loading-${i}`} height="140px" borderRadius="16px" />
      ))}
    </SimpleGrid>
  );
}
