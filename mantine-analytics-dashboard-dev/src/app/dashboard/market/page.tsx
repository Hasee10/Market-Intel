'use client';

import {
  Alert,
  Badge,
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

const PAPER_PROPS: PaperProps = {
  p: 'md',
  style: { minHeight: '100%' },
};

// Placeholder benchmark figures until domain_benchmarks is wired up (see
// migrations/011-013 + Task #6). Peer rows only ever show fields a seller
// has opted into via seller_public_profile - never raw competitor data.
const DOMAIN_STATS = [
  { title: 'Your domain', value: 'Coffee & Beverages', diff: 0 },
  { title: 'Sellers in domain', value: '18', diff: 0 },
  { title: 'Your rank (revenue)', value: '#4', diff: 0 },
  { title: 'Avg. peer rating', value: '4.3 / 5', diff: 2.1 },
];

const PEER_ROWS = [
  { name: 'Peer A', rating: 4.6, priceIndex: 'Similar', responseTime: 'Fast' },
  { name: 'Peer B', rating: 4.2, priceIndex: 'Lower', responseTime: 'Average' },
  { name: 'Peer C', rating: 4.5, priceIndex: 'Higher', responseTime: 'Fast' },
];

function Page() {
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
            You only see aggregate or seller-opted-in fields for other sellers
            in your domain (e.g. rating, price positioning, response time).
            Nothing private about a competitor&apos;s business is ever shown.
          </Alert>

          <StatsGrid data={DOMAIN_STATS} error={null} paperProps={PAPER_PROPS} />

          <Surface {...PAPER_PROPS}>
            <Group justify="space-between" mb="md">
              <Text size="lg" fw={600}>
                Peers in your domain
              </Text>
              <Badge variant="light" color="gray">
                Sample data - connects to live benchmarks next
              </Badge>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Seller</Table.Th>
                  <Table.Th>Rating</Table.Th>
                  <Table.Th>Price positioning</Table.Th>
                  <Table.Th>Response time</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {PEER_ROWS.map((row) => (
                  <Table.Tr key={row.name}>
                    <Table.Td>{row.name}</Table.Td>
                    <Table.Td>{row.rating.toFixed(1)}</Table.Td>
                    <Table.Td>{row.priceIndex}</Table.Td>
                    <Table.Td>{row.responseTime}</Table.Td>
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
                  Choose which of your own stats (rating, price range,
                  response time) other sellers in your domain can see.
                  Manage this from Settings &rarr; Public profile.
                </Text>
              </Surface>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Surface {...PAPER_PROPS}>
                <Text size="lg" fw={600} mb="xs">
                  Where this data comes from
                </Text>
                <Text size="sm" c="dimmed">
                  Benchmarks are computed from anonymized, aggregated seller
                  data in your domain - never a direct feed of another
                  seller&apos;s private orders, customers, or churn.
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
