'use client';

import { ReactNode } from 'react';

import {
  ActionIcon,
  Group,
  PaperProps,
  Skeleton,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { AreaChart } from '@mantine/charts';
import { IconDotsVertical } from '@tabler/icons-react';

import { ErrorAlert, Surface } from '@/components';

type RevenueTrendPoint = { date: string; revenue: number };

type RevenueChartProps = PaperProps & {
  data?: RevenueTrendPoint[];
  loading?: boolean;
  error?: ReactNode | Error | null;
};

const RevenueChart = ({
  data = [],
  loading = false,
  error = null,
  ...others
}: RevenueChartProps) => {
  const theme = useMantineTheme();

  return (
    <Surface {...others}>
      <Group justify="space-between" mb="md">
        <Text size="lg" fw={600}>
          Revenue (last 30 days)
        </Text>
        <ActionIcon variant="subtle">
          <IconDotsVertical size={16} />
        </ActionIcon>
      </Group>
      {error ? (
        <ErrorAlert title="Error loading revenue" message={error.toString()} />
      ) : loading ? (
        <Skeleton height={350} radius="sm" />
      ) : (
        <AreaChart
          h={350}
          data={data}
          dataKey="date"
          series={[{ name: 'revenue', color: theme.colors[theme.primaryColor][5] }]}
          curveType="natural"
          withLegend
          valueFormatter={(value) =>
            `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          }
        />
      )}
    </Surface>
  );
};

export default RevenueChart;
