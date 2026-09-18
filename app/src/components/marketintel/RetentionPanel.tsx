'use client';

import {
  Badge,
  Button,
  Icon,
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

import type { AtRiskCustomer, ChurnSnapshot } from '@/lib/market-intel/seller/rfm';
import type { RepeatStats } from '@/lib/market-intel/seller/repeat';

type RetentionData = {
  snapshot: ChurnSnapshot | null;
  atRiskCustomers: AtRiskCustomer[];
  reportingCurrency: string;
  /** Windowed repeat figures (lib/market-intel/seller/repeat.ts). Null when
   *  that query failed; the two extra tiles are simply not shown. */
  repeatStats: RepeatStats | null;
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

// Data arrives as props now, fetched server-side by the page - this used to
// fetch /api/customers/at-risk itself, a second client round trip on top of
// the Customers page's own /api/customers fetch (see apps/customers/page.tsx
// for the full rationale). RetentionData is kept as the prop shape rather
// than three loose props, matching the API response shape 1:1 - a page
// composing this alongside other panels can still pass through what one
// fetch already returned.
export function RetentionPanel({ snapshot, atRiskCustomers, reportingCurrency, repeatStats }: RetentionData) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');

  // The first four are the nightly snapshot, as before. The last two are
  // windowed and answer "customer repeat orders" the way the product notes
  // mean it - this month, not lifetime - and carry their calculation.
  const stats = [
    { title: 'Retention rate (30d)', value: formatPct(snapshot?.retentionRate ?? null), icon: 'chart-line', color: 'teal' },
    { title: 'Churn rate (30d)', value: formatPct(snapshot?.churnRate ?? null), icon: 'shopping-cart-off', color: 'red' },
    { title: 'Repeat purchase rate', value: formatPct(snapshot?.repeatPurchaseRate ?? null), icon: 'shopping-cart', color: 'blue' },
    { title: 'Avg. customer value', value: formatCurrency(snapshot?.avgClv ?? null, reportingCurrency), icon: 'currency-dollar', color: 'violet' },
    // Same rule as the Orders strip: a window with no orders shows a dash
    // and says so, not "0% · 0 of 0 customers".
    ...(repeatStats && repeatStats.customersOrdered === 0 && repeatStats.guestOrders === 0
      ? [
          { title: 'Returning buyers', value: '—', period: `No orders in the last ${repeatStats.periodDays} days`, icon: 'users', color: 'teal',
            help: `Of the customers who ordered in the last ${repeatStats.periodDays} days, the share whose first order was before that window. Needs at least one order in the window.` },
          { title: 'Revenue from returning buyers', value: '—', period: `No orders in the last ${repeatStats.periodDays} days`, icon: 'currency-dollar', color: 'blue',
            help: `Order totals from returning customers in the last ${repeatStats.periodDays} days, over all order totals in that window.` },
        ]
      : []),
    ...(repeatStats && (repeatStats.customersOrdered > 0 || repeatStats.guestOrders > 0)
      ? [
          {
            title: 'Returning buyers',
            value: `${repeatStats.repeatShare}%`,
            diff: repeatStats.change.repeatShare ?? undefined,
            period: `${repeatStats.repeatCustomers} of ${repeatStats.customersOrdered} customers · last ${repeatStats.periodDays} days`,
            icon: 'users',
            color: 'teal',
            help: `Of the customers who ordered in the last ${repeatStats.periodDays} days, the share whose first order was before that window. Guest orders (no customer) are not counted either way. The change compares with the ${repeatStats.periodDays} days before.`,
          },
          {
            title: 'Revenue from returning buyers',
            value: `${repeatStats.repeatRevenueShare}%`,
            diff: repeatStats.change.repeatRevenueShare ?? undefined,
            period: `${formatCurrency(repeatStats.repeatRevenue, reportingCurrency)} of ${formatCurrency(repeatStats.revenue, reportingCurrency)}`,
            icon: 'currency-dollar',
            color: 'blue',
            help: `Order totals from returning customers in the last ${repeatStats.periodDays} days, over all order totals in that window, converted to ${reportingCurrency}.`,
          },
        ]
      : []),
  ];

  return (
    <>
      <InsightStrip insight={computeRetentionInsight(snapshot, atRiskCustomers)} />

      <StatsGrid data={stats} columns={repeatStats ? 3 : 4} />

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
