'use client';

import {
  Badge,
  Button,
  Icon,
  SimpleGrid,
  Skeleton,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import { MdDownload } from 'react-icons/md';

import Card from 'components/card/Card';
import MiniStatistics from 'components/card/MiniStatistics';

import { useFetch } from '@/lib/hooks/useApi';
import { IApiResponse } from '@/types/api-response';
import type { AtRiskCustomer, ChurnSnapshot } from '@/lib/market-intel/rfm';

type RetentionData = {
  snapshot: ChurnSnapshot | null;
  atRiskCustomers: AtRiskCustomer[];
  reportingCurrency: string;
};

function formatPct(value: number | null) {
  return value != null ? `${value.toFixed(1)}%` : '—';
}

function formatCurrency(value: number | null, currency: string) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function downloadCsv(customers: AtRiskCustomer[]) {
  const header = 'Customer,Days since last order,Orders,Total spent,Recency score,Frequency score,Monetary score';
  const rows = customers.map((c) =>
    [c.label, c.daysSinceLastOrder, c.ordersCount, c.totalSpent, c.recencyScore, c.frequencyScore, c.monetaryScore]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `at-risk-customers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RetentionPanel() {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const { data, loading } = useFetch<IApiResponse<RetentionData>>('/api/customers/at-risk');
  const snapshot = data?.data?.snapshot ?? null;
  const atRiskCustomers = data?.data?.atRiskCustomers ?? [];
  const reportingCurrency = data?.data?.reportingCurrency ?? 'PKR';

  if (loading) {
    return <Skeleton height="200px" borderRadius="16px" mb="20px" />;
  }

  const stats = [
    { title: 'Retention rate (30d)', value: formatPct(snapshot?.retentionRate ?? null) },
    { title: 'Churn rate (30d)', value: formatPct(snapshot?.churnRate ?? null) },
    { title: 'Repeat purchase rate', value: formatPct(snapshot?.repeatPurchaseRate ?? null) },
    { title: 'Avg. customer value', value: formatCurrency(snapshot?.avgClv ?? null, reportingCurrency) },
  ];

  return (
    <>
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="20px" mb="20px">
        {stats.map((s) => (
          <MiniStatistics key={s.title} name={s.title} value={s.value} />
        ))}
      </SimpleGrid>

      <Card mb="20px">
        <Icon as={MdDownload} display="none" />
        <Text fontSize="lg" fontWeight="600" color={textColor} mb="4px">
          At-risk customers
        </Text>
        <Text fontSize="sm" color="secondaryGray.600" mb="12px">
          Previously engaged customers who have gone quiet - RFM-scored (recency/frequency/monetary),
          flagged when a customer with above-average order history or spend hasn&apos;t ordered
          recently.
        </Text>

        {atRiskCustomers.length === 0 ? (
          <Text fontSize="sm" color="secondaryGray.600">
            {snapshot === null
              ? 'Not enough order history yet to compute retention metrics.'
              : 'No at-risk customers right now - retention looks healthy.'}
          </Text>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Icon as={MdDownload} />}
              mb="12px"
              onClick={() => downloadCsv(atRiskCustomers)}
            >
              Export CSV
            </Button>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Customer</Th>
                  <Th isNumeric>Days since last order</Th>
                  <Th isNumeric>Orders</Th>
                  <Th isNumeric>Total spent</Th>
                  <Th>RFM</Th>
                </Tr>
              </Thead>
              <Tbody>
                {atRiskCustomers.map((c) => (
                  <Tr key={c.id}>
                    <Td>{c.label}</Td>
                    <Td isNumeric>{c.daysSinceLastOrder}</Td>
                    <Td isNumeric>{c.ordersCount}</Td>
                    <Td isNumeric>{formatCurrency(c.totalSpent, c.currency)}</Td>
                    <Td>
                      <Badge colorScheme="orange">
                        R{c.recencyScore} F{c.frequencyScore} M{c.monetaryScore}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </>
        )}
      </Card>
    </>
  );
}

export default RetentionPanel;
