import Link from 'next/link';

import {
  Alert,
  Badge,
  Button,
  Container,
  Grid,
  Group,
  PaperProps,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import { PageHeader, StatsGrid, Surface } from '@/components';
import { getDomainBenchmarks, getDomainPeers } from '@/lib/market-intel/benchmarks';
import { getCategoryPricing } from '@/lib/market-intel/category-pricing';
import { getCurrentSeller, getPrimaryDomain } from '@/lib/market-intel/seller';
import { PATH_ONBOARDING } from '@/routes';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value);
}

const PAPER_PROPS: PaperProps = {
  p: 'md',
  style: { minHeight: '100%' },
};

function formatMetric(metricName: string) {
  return metricName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function Page() {
  const seller = await getCurrentSeller();
  const domain = seller ? await getPrimaryDomain(seller.id) : null;

  const benchmarks = domain ? await getDomainBenchmarks(domain.categoryId) : [];
  const peers = domain && seller ? await getDomainPeers(domain.categoryId, seller.id) : [];
  const categoryPricing = domain ? await getCategoryPricing(domain.categorySlug) : null;

  // The scraper-side aggregation job that populates domain_benchmarks
  // hasn't run yet for most categories - sample_size on any one metric row
  // is a reasonable stand-in for "sellers in domain" until we track that
  // directly (see 011_create_seller_platform_tables.sql / 012 policies).
  const sellersInDomain = benchmarks[0]?.sampleSize ?? null;

  const domainStats = [
    { title: 'Your domain', value: domain?.categoryName ?? 'Not set', diff: 0 },
    { title: 'Sellers in domain', value: sellersInDomain != null ? String(sellersInDomain) : '—', diff: 0 },
    { title: 'Peers visible to you', value: String(peers.length), diff: 0 },
    {
      title: 'Benchmarks tracked',
      value: String(benchmarks.length),
      diff: 0,
    },
  ];

  return (
    <>
      <>
        <title>Market | Market Intel</title>
        <meta
          name="description"
          content="See how you compare to other sellers in your domain using only non-sensitive, opt-in benchmark data."
        />
      </>
      <Container fluid>
        <Stack gap="lg">
          <PageHeader title="Market" />

          <Alert
            icon={<IconInfoCircle size={18} />}
            color="blue"
            variant="light"
            title="Peer benchmarking, not surveillance"
          >
            You only see aggregate or seller-opted-in fields for other sellers in your domain
            (e.g. rating, price positioning, response time). Nothing private about a
            competitor&apos;s business is ever shown.
          </Alert>

          {!domain && (
            <Alert color="yellow" title="Pick your domain to see benchmarks">
              <Group justify="space-between" align="center">
                <Text size="sm">
                  You haven&apos;t set a domain yet, so we can&apos;t show you peer benchmarks.
                </Text>
                <Button component={Link} href={PATH_ONBOARDING} size="xs">
                  Choose domain
                </Button>
              </Group>
            </Alert>
          )}

          <StatsGrid data={domainStats} error={null} paperProps={PAPER_PROPS} />

          <Surface {...PAPER_PROPS}>
            <Group justify="space-between" mb="md">
              <Text size="lg" fw={600}>
                Domain benchmarks
              </Text>
              {domain && benchmarks.length === 0 && (
                <Badge variant="light" color="gray">
                  No benchmarks computed for this domain yet
                </Badge>
              )}
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Metric</Table.Th>
                  <Table.Th>P25</Table.Th>
                  <Table.Th>Median</Table.Th>
                  <Table.Th>P75</Table.Th>
                  <Table.Th>Sample size</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {benchmarks.map((row) => (
                  <Table.Tr key={row.metricName}>
                    <Table.Td>{formatMetric(row.metricName)}</Table.Td>
                    <Table.Td>{row.p25 ?? '—'}</Table.Td>
                    <Table.Td>{row.median ?? '—'}</Table.Td>
                    <Table.Td>{row.p75 ?? '—'}</Table.Td>
                    <Table.Td>{row.sampleSize}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Surface>

          <Surface {...PAPER_PROPS}>
            <Group justify="space-between" mb="md">
              <Text size="lg" fw={600}>
                Category pricing (market-wide)
              </Text>
              {domain && !categoryPricing && (
                <Badge variant="light" color="gray">
                  No market pricing data for this category yet
                </Badge>
              )}
            </Group>
            {categoryPricing ? (
              <>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Min</Table.Th>
                      <Table.Th>P25</Table.Th>
                      <Table.Th>Median</Table.Th>
                      <Table.Th>P75</Table.Th>
                      <Table.Th>Max</Table.Th>
                      <Table.Th>Average</Table.Th>
                      <Table.Th>Listings tracked</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>{formatCurrency(categoryPricing.minPrice)}</Table.Td>
                      <Table.Td>{formatCurrency(categoryPricing.p25)}</Table.Td>
                      <Table.Td>{formatCurrency(categoryPricing.median)}</Table.Td>
                      <Table.Td>{formatCurrency(categoryPricing.p75)}</Table.Td>
                      <Table.Td>{formatCurrency(categoryPricing.maxPrice)}</Table.Td>
                      <Table.Td>{formatCurrency(categoryPricing.avgPrice)}</Table.Td>
                      <Table.Td>{categoryPricing.count}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
                <Text size="xs" c="dimmed" mt="xs">
                  Scraped from {categoryPricing.samplePlatforms.join(', ')} - refreshed
                  automatically every 2 days.
                </Text>
              </>
            ) : (
              <Text size="sm" c="dimmed">
                We haven&apos;t scraped competitor pricing for this category yet. Coverage is
                expanding source by source.
              </Text>
            )}
          </Surface>

          <Surface {...PAPER_PROPS}>
            <Group justify="space-between" mb="md">
              <Text size="lg" fw={600}>
                Peers in your domain
              </Text>
              {domain && peers.length === 0 && (
                <Badge variant="light" color="gray">
                  No peers have opted in to be visible yet
                </Badge>
              )}
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Seller</Table.Th>
                  <Table.Th>Shares rating</Table.Th>
                  <Table.Th>Shares price positioning</Table.Th>
                  <Table.Th>Shares category rank</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {peers.map((peer) => (
                  <Table.Tr key={peer.sellerId}>
                    <Table.Td>{peer.displayName ?? 'Anonymous seller'}</Table.Td>
                    <Table.Td>{peer.showRating ? 'Yes' : 'No'}</Table.Td>
                    <Table.Td>{peer.showPricePosition ? 'Yes' : 'No'}</Table.Td>
                    <Table.Td>{peer.showCategoryRank ? 'Yes' : 'No'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Surface>

          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Surface {...PAPER_PROPS}>
                <Text size="lg" fw={600} mb="xs">
                  Opt in to be visible to peers
                </Text>
                <Text size="sm" c="dimmed">
                  Choose which of your own stats (rating, price range, response time) other
                  sellers in your domain can see. Manage this from Settings &rarr; Public
                  profile.
                </Text>
              </Surface>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Surface {...PAPER_PROPS}>
                <Text size="lg" fw={600} mb="xs">
                  Where this data comes from
                </Text>
                <Text size="sm" c="dimmed">
                  Benchmarks are computed from anonymized, aggregated seller data in your
                  domain - never a direct feed of another seller&apos;s private orders,
                  customers, or churn.
                </Text>
              </Surface>
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
    </>
  );
}

export default Page;
