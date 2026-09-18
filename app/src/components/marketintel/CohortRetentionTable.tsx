'use client';

import { Box, Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue } from '@chakra-ui/react';

import Card from 'components/card/Card';
import { MetricHelp } from '@/components/ui/MetricHelp';
import type { CohortRow } from '@/lib/market-intel/seller/repeat';

// Cohort retention: acquisition month down the side, months-since-first-
// order across the top, each cell the share of that cohort still ordering.
//
// Chakra rather than the Tailwind Table, to match RetentionPanel directly
// above it - the Customers page is still a Chakra page and mixing the two
// on one screen is the thing MIGRATION_PLAN.md says not to do mid-page.
//
// Cells shade by value so the eye reads the diagonal without reading the
// numbers: retention that holds up looks like a solid block, retention
// that decays looks like a fading stripe. Month 0 is 100% by definition
// and is rendered dimmer so it doesn't dominate.
//
// Empty (no rows) is a real state for a new seller and for a seller whose
// customers have no first_order_at, and it says which rather than showing
// an empty grid.

type Props = { rows: CohortRow[] };

function monthLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function cellBg(rate: number, light: boolean) {
  // 0..100 → 0..0.55 opacity of the brand blue. Light theme darkens text at
  // the top of the range so 90%+ stays readable.
  const alpha = Math.min(rate, 100) / 100 * 0.55;
  return light ? `rgba(67, 24, 255, ${alpha})` : `rgba(122, 90, 255, ${alpha})`;
}

export function CohortRetentionTable({ rows }: Props) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const light = useColorModeValue(true, false);

  const cohorts = Array.from(new Set(rows.map((r) => r.cohortMonth))).sort();
  const maxOffset = rows.reduce((m, r) => Math.max(m, r.monthOffset), 0);
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);
  const byKey = new Map(rows.map((r) => [`${r.cohortMonth}:${r.monthOffset}`, r]));

  return (
    <Card mb="20px">
      <Box display="flex" alignItems="center" gap="6px" mb="4px">
        <Text fontSize="lg" fontWeight="600" color={textColor}>
          Cohort retention
        </Text>
        <MetricHelp label="How cohort retention is calculated">
          Each row is the customers whose first order fell in that month. Each column is how many months later. A cell is the share of that row&apos;s customers who placed at least one order in that later month. Month 0 is always 100%.
        </MetricHelp>
      </Box>
      <Text fontSize="sm" color="secondaryGray.600" mb="12px">
        Of the customers gained each month, how many were still ordering one, two, three months on.
      </Text>

      {cohorts.length === 0 ? (
        <Text fontSize="sm" color="secondaryGray.600">
          No cohorts yet. This fills in once customers have a first-order date and at least one month has passed.
        </Text>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Cohort</Th>
                <Th isNumeric>Customers</Th>
                {offsets.map((o) => (
                  <Th key={o} isNumeric>
                    {o === 0 ? 'Month 0' : `+${o}`}
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {cohorts.map((cohort) => {
                const size = byKey.get(`${cohort}:0`)?.customers ?? rows.find((r) => r.cohortMonth === cohort)?.customers ?? 0;
                return (
                  <Tr key={cohort}>
                    <Td whiteSpace="nowrap">{monthLabel(cohort)}</Td>
                    <Td isNumeric>{size}</Td>
                    {offsets.map((o) => {
                      const cell = byKey.get(`${cohort}:${o}`);
                      if (!cell) {
                        return <Td key={o} isNumeric color="secondaryGray.500">—</Td>;
                      }
                      return (
                        <Td
                          key={o}
                          isNumeric
                          bg={cellBg(cell.retentionRate, light)}
                          color={o === 0 ? 'secondaryGray.600' : cell.retentionRate > 60 && light ? 'white' : textColor}
                          fontWeight={o === 0 ? '400' : '600'}
                          title={`${cell.retained} of ${cell.customers} customers`}
                        >
                          {cell.retentionRate}%
                        </Td>
                      );
                    })}
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      )}
    </Card>
  );
}

export default CohortRetentionTable;
