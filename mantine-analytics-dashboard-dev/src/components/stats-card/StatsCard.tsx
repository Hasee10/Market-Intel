import { Group, PaperProps, Text, ThemeIcon } from '@mantine/core';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconChartLine,
  IconCurrencyDollar,
  IconReceipt,
  IconShoppingCart,
  IconShoppingCartOff,
  IconUsers,
} from '@tabler/icons-react';

import { Surface } from '@/components';

import classes from './StatsCard.module.css';

const ICONS: Record<string, typeof IconChartLine> = {
  'currency-dollar': IconCurrencyDollar,
  'shopping-cart': IconShoppingCart,
  'shopping-cart-off': IconShoppingCartOff,
  receipt: IconReceipt,
  users: IconUsers,
  'chart-line': IconChartLine,
};

type StatsCardProps = {
  data: {
    title: string;
    value: string;
    diff: number;
    period?: string;
    icon?: string;
    color?: string;
  };
} & PaperProps;

const StatsCard = ({ data, ...others }: StatsCardProps) => {
  const { title, value, period, diff, icon, color } = data;
  const DiffIcon = diff > 0 ? IconArrowUpRight : IconArrowDownRight;
  const Icon = (icon && ICONS[icon]) || IconChartLine;

  return (
    <Surface {...others}>
      <Group justify="space-between" align="flex-start">
        <Text size="xs" className={classes.title}>
          {title}
        </Text>
        <ThemeIcon size="lg" radius="md" variant="light" color={color || 'blue'}>
          <Icon size={18} />
        </ThemeIcon>
      </Group>

      <Group align="flex-end" gap="xs" mt={25}>
        <Text className={classes.value}>{value}</Text>
        <Text
          c={diff > 0 ? 'teal' : 'red'}
          fz="sm"
          fw={500}
          className={classes.diff}
        >
          <span>{diff}%</span>
          <DiffIcon size="1rem" stroke={1.5} />
        </Text>
      </Group>

      {period && (
        <Text fz="xs" c="dimmed" mt={7}>
          {period}
        </Text>
      )}
    </Surface>
  );
};

export default StatsCard;
