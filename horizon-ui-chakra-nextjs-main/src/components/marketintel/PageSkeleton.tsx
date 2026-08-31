'use client';

import { Box, Flex, Grid, Skeleton, SimpleGrid } from '@chakra-ui/react';

import Card from 'components/card/Card';

// Route-level loading UI for the server-rendered dashboard pages.
//
// Those pages fetch everything server-side before returning any HTML, so
// without a loading.tsx Next.js has nothing to show during the navigation -
// the browser sits on the *previous* page, fully interactive-looking but
// unresponsive to further clicks, until the new page's last query resolves.
// That dead interval is most of what "the app feels slow" means here, and it
// is invisible in a query-timing audit because no single query is slow.
//
// Deliberately mirrors the real page's layout (header, stat row, chart/table
// blocks) rather than a generic spinner, so the shell doesn't jump when the
// real content swaps in.
export function PageSkeleton({
  stats = 4,
  blocks = 2,
}: {
  /** KPI cards in the top row. 0 to omit the row entirely. */
  stats?: number;
  /** Large content cards below the stat row. */
  blocks?: number;
}) {
  return (
    <Box>
      <Flex justify="space-between" align="center" mb="20px">
        <Skeleton height="32px" width="220px" borderRadius="8px" />
        <Skeleton height="36px" width="140px" borderRadius="10px" />
      </Flex>

      {stats > 0 && (
        <SimpleGrid columns={{ base: 1, md: 2, lg: stats }} gap="20px" mb="20px">
          {Array.from({ length: stats }).map((_, i) => (
            <Card key={i}>
              <Skeleton height="14px" width="60%" mb="10px" borderRadius="6px" />
              <Skeleton height="26px" width="45%" borderRadius="6px" />
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Grid templateColumns={{ base: '1fr', lg: blocks > 1 ? '2fr 1fr' : '1fr' }} gap="20px">
        {Array.from({ length: blocks }).map((_, i) => (
          <Card key={i}>
            <Skeleton height="18px" width="180px" mb="14px" borderRadius="6px" />
            <Skeleton height="260px" borderRadius="12px" />
          </Card>
        ))}
      </Grid>
    </Box>
  );
}

export default PageSkeleton;
