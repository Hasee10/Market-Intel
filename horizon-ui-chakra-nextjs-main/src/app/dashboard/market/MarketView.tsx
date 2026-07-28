'use client';

import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import Link from 'next/link';

import Card from 'components/card/Card';

import { PageHeader } from '@/components/marketintel/PageHeader';
import { StatsGrid } from '@/components/marketintel/StatsGrid';
import type { CategoryPricing } from '@/lib/market-intel/category-pricing';
import type { DomainBenchmark, DomainPeer } from '@/lib/market-intel/benchmarks';
import type { SellerDomain } from '@/lib/market-intel/seller';
import { PATH_ONBOARDING } from '@/lib/paths';

function formatMetric(metricName: string) {
  return metricName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value);
}

type MarketViewProps = {
  domain: SellerDomain | null;
  benchmarks: DomainBenchmark[];
  peers: DomainPeer[];
  categoryPricing: CategoryPricing | null;
};

export default function MarketView({ domain, benchmarks, peers, categoryPricing }: MarketViewProps) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const sellersInDomain = benchmarks[0]?.sampleSize ?? null;

  const domainStats = [
    { title: 'Your domain', value: domain?.categoryName ?? 'Not set' },
    { title: 'Sellers in domain', value: sellersInDomain != null ? String(sellersInDomain) : '—' },
    { title: 'Peers visible to you', value: String(peers.length) },
    { title: 'Benchmarks tracked', value: String(benchmarks.length) },
  ];

  return (
    <Box>
      <PageHeader title="Market" />

      <Alert status="info" borderRadius="16px" mb="20px">
        <AlertIcon />
        <Box>
          <AlertTitle>Peer benchmarking, not surveillance</AlertTitle>
          <AlertDescription>
            You only see aggregate or seller-opted-in fields for other sellers in your domain
            (e.g. rating, price positioning, response time). Nothing private about a
            competitor&apos;s business is ever shown.
          </AlertDescription>
        </Box>
      </Alert>

      {!domain && (
        <Alert status="warning" borderRadius="16px" mb="20px">
          <AlertIcon />
          <Flex justify="space-between" align="center" w="100%">
            <Text fontSize="sm">
              You haven&apos;t set a domain yet, so we can&apos;t show you peer benchmarks.
            </Text>
            <Button as={Link} href={PATH_ONBOARDING} size="sm" variant="brand">
              Choose domain
            </Button>
          </Flex>
        </Alert>
      )}

      <StatsGrid data={domainStats} columns={4} />

      <Card mb="20px">
        <Flex justify="space-between" align="center" mb="12px">
          <Text fontSize="lg" fontWeight="600" color={textColor}>
            Domain benchmarks
          </Text>
          {domain && benchmarks.length === 0 && (
            <Badge colorScheme="gray">No benchmarks computed for this domain yet</Badge>
          )}
        </Flex>
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Metric</Th>
                <Th>P25</Th>
                <Th>Median</Th>
                <Th>P75</Th>
                <Th>Sample size</Th>
              </Tr>
            </Thead>
            <Tbody>
              {benchmarks.map((row) => (
                <Tr key={row.metricName}>
                  <Td>{formatMetric(row.metricName)}</Td>
                  <Td>{row.p25 ?? '—'}</Td>
                  <Td>{row.median ?? '—'}</Td>
                  <Td>{row.p75 ?? '—'}</Td>
                  <Td>{row.sampleSize}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Card>

      <Card mb="20px">
        <Flex justify="space-between" align="center" mb="12px">
          <Text fontSize="lg" fontWeight="600" color={textColor}>
            Category pricing (market-wide)
          </Text>
          {domain && !categoryPricing && (
            <Badge colorScheme="gray">No market pricing data for this category yet</Badge>
          )}
        </Flex>
        {categoryPricing ? (
          <>
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Min</Th>
                    <Th>P25</Th>
                    <Th>Median</Th>
                    <Th>P75</Th>
                    <Th>Max</Th>
                    <Th>Average</Th>
                    <Th>Listings tracked</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  <Tr>
                    <Td>{formatCurrency(categoryPricing.minPrice)}</Td>
                    <Td>{formatCurrency(categoryPricing.p25)}</Td>
                    <Td>{formatCurrency(categoryPricing.median)}</Td>
                    <Td>{formatCurrency(categoryPricing.p75)}</Td>
                    <Td>{formatCurrency(categoryPricing.maxPrice)}</Td>
                    <Td>{formatCurrency(categoryPricing.avgPrice)}</Td>
                    <Td>{categoryPricing.count}</Td>
                  </Tr>
                </Tbody>
              </Table>
            </Box>
            <Text fontSize="xs" color="secondaryGray.600" mt="8px">
              Scraped from {categoryPricing.samplePlatforms.join(', ')} - refreshed automatically
              every 2 days.
            </Text>
          </>
        ) : (
          <Text fontSize="sm" color="secondaryGray.600">
            We haven&apos;t scraped competitor pricing for this category yet. Coverage is
            expanding source by source.
          </Text>
        )}
      </Card>

      <Card mb="20px">
        <Flex justify="space-between" align="center" mb="12px">
          <Text fontSize="lg" fontWeight="600" color={textColor}>
            Peers in your domain
          </Text>
          {domain && peers.length === 0 && (
            <Badge colorScheme="gray">No peers have opted in to be visible yet</Badge>
          )}
        </Flex>
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Seller</Th>
                <Th>Shares rating</Th>
                <Th>Shares price positioning</Th>
                <Th>Shares category rank</Th>
              </Tr>
            </Thead>
            <Tbody>
              {peers.map((peer) => (
                <Tr key={peer.sellerId}>
                  <Td>{peer.displayName ?? 'Anonymous seller'}</Td>
                  <Td>{peer.showRating ? 'Yes' : 'No'}</Td>
                  <Td>{peer.showPricePosition ? 'Yes' : 'No'}</Td>
                  <Td>{peer.showCategoryRank ? 'Yes' : 'No'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Card>

      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap="20px">
        <Card>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="6px">
            Opt in to be visible to peers
          </Text>
          <Text fontSize="sm" color="secondaryGray.600">
            Choose which of your own stats (rating, price range, response time) other sellers in
            your domain can see. Manage this from Settings &rarr; Public profile.
          </Text>
        </Card>
        <Card>
          <Text fontSize="lg" fontWeight="600" color={textColor} mb="6px">
            Where this data comes from
          </Text>
          <Text fontSize="sm" color="secondaryGray.600">
            Benchmarks are computed from anonymized, aggregated seller data in your domain - never
            a direct feed of another seller&apos;s private orders, customers, or churn.
          </Text>
        </Card>
      </Grid>
    </Box>
  );
}
