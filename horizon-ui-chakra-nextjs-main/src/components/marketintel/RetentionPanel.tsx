'use client';

import {
  Badge,
  Button,
  Icon,
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
import { MdDownload, MdOutlinePersonOff, MdOutlineHourglassEmpty, MdOutlineCheckCircle } from 'react-icons/md';

import Card from 'components/card/Card';
import { StatsGrid } from '@/components/marketintel/StatsGrid';
import { InsightStrip, type Insight } from '@/components/marketintel/InsightStrip';

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

// Same instant-insight pattern used across the app (InsightStrip.tsx).
// Priority: at-risk customers (the reason this panel exists) > not enough
// order history yet to compute retention at all (a real data-coverage gap,
// not a calm state - the empty-state text below already says this, the
// strip just makes it the headline instead of something read only after
// scrolling past an empty table) > calm fallback stating the real
// retention rate, not just "looks fine".
function computeRetentionInsight(snapshot: ChurnSnapshot | null, atRiskCustomers: AtRiskCustomer[]): Insight {
  if (atRiskCustomers.length > 0) {
    return {
      tone: 'warning',
      icon: MdOutlinePersonOff,
      headline: `${atRiskCustomers.length} customer${atRiskCustomers.length === 1 ? '' : 's'} at risk of churning`,
      detail: "Above-average engagement, gone quiet recently - worth a win-back outreach.",
    };
  }

  if (snapshot === null) {
    return {
      tone: 'neutral',
      icon: MdOutlineHourglassEmpty,
      headline: 'Not enough order history yet to compute retention',
      detail: 'Retention metrics need repeat orders to calculate - check back once you have more history.',
    };
  }

  return {
    tone: 'good',
    icon: MdOutlineCheckCircle,
    headline: 'Retention looks healthy',
    detail: `${formatPct(snapshot.retentionRate)} retention rate - no customers currently flagged at risk.`,
  };
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
    { title: 'Retention rate (30d)', value: formatPct(snapshot?.retentionRate ?? null), icon: 'chart-line', color: 'teal' },
    { title: 'Churn rate (30d)', value: formatPct(snapshot?.churnRate ?? null), icon: 'shopping-cart-off', color: 'red' },
    { title: 'Repeat purchase rate', value: formatPct(snapshot?.repeatPurchaseRate ?? null), icon: 'shopping-cart', color: 'blue' },
    { title: 'Avg. customer value', value: formatCurrency(snapshot?.avgClv ?? null, reportingCurrency), icon: 'currency-dollar', color: 'violet' },
  ];

  return (
    <>
      <InsightStrip insight={computeRetentionInsight(snapshot, atRiskCustomers)} />

      <StatsGrid data={stats} columns={4} />

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
