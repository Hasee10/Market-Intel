'use client';

import { Badge, Box, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';

import Card from 'components/card/Card';

import { PageHeader } from '@/components/marketintel/PageHeader';
import type { PlatformHealth } from '@/lib/market-intel/market/scraper-health';

function formatRelativeTime(iso: string) {
  const hours = Math.round((Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000));
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function healthColor(failureRatePct: number) {
  if (failureRatePct === 0) return 'green';
  if (failureRatePct < 25) return 'orange';
  return 'red';
}

export default function ScraperHealthView({ platforms }: { platforms: PlatformHealth[] }) {
  return (
    <Box>
      <PageHeader title="Data Health" />

      <Text fontSize="sm" color="secondaryGray.600" mb="16px">
        Internal reliability view over the last 20 scrape runs per source - this is what backs
        the &quot;last scraped&quot; badges on the Market page. A high failure rate usually means
        a source is blocking automated requests (Cloudflare, expired TLS certs) rather than a
        genuine data-quality problem.
      </Text>

      <Card>
        {platforms.length === 0 ? (
          <Text fontSize="sm" color="secondaryGray.600">
            No scrape runs recorded yet.
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Source</Th>
                  <Th>Last run</Th>
                  <Th isNumeric>Items last run</Th>
                  <Th isNumeric>Failure rate (last 20 runs)</Th>
                  <Th>Last error</Th>
                </Tr>
              </Thead>
              <Tbody>
                {platforms.map((p) => (
                  <Tr key={p.platformSlug}>
                    <Td>{p.platformSlug}</Td>
                    <Td>{formatRelativeTime(p.lastRunAt)}</Td>
                    <Td isNumeric>{p.lastRunProductCount}</Td>
                    <Td isNumeric>
                      <Badge colorScheme={healthColor(p.failureRatePct)}>{p.failureRatePct}%</Badge>
                    </Td>
                    <Td>
                      <Text fontSize="xs" color="secondaryGray.600" maxW="320px" noOfLines={2}>
                        {p.lastRunError ?? '—'}
                      </Text>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Card>
    </Box>
  );
}
